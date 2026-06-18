import OpenAI from "openai";
import crypto from "crypto";
import { query } from "./db.js";

let openai: OpenAI;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

async function saveChatMessage(businessId: string, conversationId: string, role: string, content: string) {
  const msgId = crypto.randomUUID();
  return query(`
    INSERT INTO chat_messages (id, business_id, conversation_id, role, content)
    VALUES ('${msgId}', '${businessId}', '${conversationId}', '${role}', '${content.replace(/'/g, "''")}')
  `);
}

export async function generateSocialPosts(businessId: string, category: string, businessName: string) {
  console.log(`Generating overhauled posts for ${businessName} (${category})...`);
  const client = getOpenAI();
  
  // Fetch detailed business info
  const businesses = await query(`SELECT * FROM businesses WHERE id = '${businessId}'`);
  const business = businesses[0] || {};
  
  // Fetch service catalog
  const services = await query(`SELECT * FROM services WHERE business_id = '${businessId}'`);
  const servicesList = services.map((s: any) => `${s.name}: ${s.description} ($${s.price})`).join("\n");

  // Fetch media library (just URLs for now to inform the prompt)
  const media = await query(`SELECT url FROM media WHERE business_id = '${businessId}' LIMIT 5`);
  const mediaUrls = media.map((m: any) => m.url).join(", ");

  // Fetch previously approved posts to learn preferences
  const approvedPosts = await query(`SELECT content FROM posts WHERE business_id = '${businessId}' AND status IN ('approved', 'scheduled', 'posted') LIMIT 5`);
  const preferences = approvedPosts.map((p: any) => p.content).join("\n---\n");

  const prompt = `
    You are an expert social media manager for "${businessName}", a local ${category} business.
    Location: ${business.address || "Local area"}
    Hours: ${business.hours || "Contact for hours"}
    Services:
    ${servicesList || "Professional " + category + " services"}
    
    Media available: ${mediaUrls || "Generic high-quality images"}

    Past Successful Posts (Use these as inspiration for style/tone):
    ${preferences || "No past data yet. Be creative!"}

    Generate 3 high-quality, engaging social media post options for this business. 
    Vary the tone across these 3 options:
    1. **Educational**: Share a tip or fact related to the industry.
    2. **Promotional**: Focus on a specific service or offer with a strong CTA.
    3. **Lifestyle/Behind-the-Scenes**: Create a relatable post that humanizes the business.

    Each post MUST follow this structure:
    - **Hook**: A scroll-stopping first line.
    - **Body**: Engaging description of the service/benefit.
    - **Emojis**: Relevant and well-placed.
    - **CTA**: Clear call-to-action (e.g., "Book now", "Visit us today", "Link in bio").
    - **Hashtags**: Relevant local and industry tags.
    - **Image Prompt**: A detailed prompt for DALL-E 3 to generate a realistic, professional photo that perfectly matches the caption.

    Format the output as a JSON object with a "posts" key containing an array:
    {
      "posts": [
        {
          "type": "Educational",
          "content": "caption text here",
          "imagePrompt": "DALL-E prompt here"
        },
        ...
      ]
    }
    Only return the JSON.
  `;

  let posts: any[] = [];
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional marketing AI that generates structured, high-converting social media content." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content generated");

    const parsed = JSON.parse(content);
    posts = parsed.posts || [];
  } catch (error: any) {
    console.error("OpenAI Chat API error:", error.message);
    // Fallback to simpler mock data if API fails
    posts = [
      { type: "Educational", content: `Did you know that regular ${category} maintenance saves you money in the long run? at ${businessName}, we help you stay ahead. #local #expert`, imagePrompt: `A professional ${category} setup.` },
      { type: "Promotional", content: `Ready for a refresh? Book your next ${category} appointment at ${businessName}! 🗓️ Check out our ${services[0]?.name || "top services"}. #booknow #style`, imagePrompt: `A satisfied customer at ${businessName}.` },
      { type: "Lifestyle", content: `We love being part of the ${business.address || "local"} community! Stop by and say hi. 👋 #community #shoplocal`, imagePrompt: `The friendly storefront of ${businessName}.` }
    ];
  }

  const generatedPosts = [];
  for (const post of posts) {
    let imageUrl = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800";
    try {
      const imageResponse = await client.images.generate({
        model: "dall-e-3",
        prompt: `High-quality, realistic, professional photography for a ${category} business. ${post.imagePrompt}. 4k, bright lighting, commercial style.`,
        n: 1,
        size: "1024x1024",
      });
      if (imageResponse.data && imageResponse.data.length > 0) {
        imageUrl = imageResponse.data[0].url || imageUrl;
      }
    } catch (imgErr: any) {
      console.error("Image generation failed:", imgErr.message);
    }

    const postId = crypto.randomUUID();
    await query(`
      INSERT INTO posts (id, business_id, content, image_url, status)
      VALUES ('${postId}', '${businessId}', '${post.content.replace(/'/g, "''")}', '${imageUrl}', 'pending')
    `);

    generatedPosts.push({
      id: postId,
      business_id: businessId,
      content: post.content,
      image_url: imageUrl,
      status: "pending"
    });
  }

  return generatedPosts;
}

export async function chatWithAI(businessId: string, conversationId: string, userMessage: string, platform: string = 'website') {
  console.log(`Chatting for business ${businessId} on ${platform}...`);
  const client = getOpenAI();

  try {
    const businesses = await query(`SELECT * FROM businesses WHERE id = '${businessId}'`);
    if (!businesses || businesses.length === 0) throw new Error("Business not found");
    const biz = businesses[0];

    const services = await query(`SELECT * FROM services WHERE business_id = '${businessId}'`);
    const servicesText = services.map((s: any) => `${s.name}: ${s.description} ($${s.price})`).join(", ");

    const config = biz.chatbot_config ? JSON.parse(biz.chatbot_config) : {};

    // Fetch conversation history
    const history = await query(`
      SELECT role, content FROM chat_messages 
      WHERE conversation_id = '${conversationId}' 
      ORDER BY created_at ASC 
      LIMIT 10
    `);

    const systemPrompt = `
      You are an AI customer assistant for "${biz.name}", a local ${biz.category}.
      Platform: ${platform}
      
      Business Context:
      - Location: ${biz.address || "Ask for location"}
      - Phone: ${biz.phone || "Ask for phone"}
      - Website: ${biz.website || "Ask for website"}
      - Hours: ${biz.hours || "Ask for hours"}
      - Services: ${servicesText}
      - Extra Info: ${config.extraInfo || ""}

      Booking Instructions:
      - If a customer wants to book/reserve, you MUST extract: 
        1. Service Name
        2. Date
        3. Time
        4. Customer Name
        5. Phone Number
      - If details are missing, ask for them one by one.
      - Once you have ALL details, confirm them and tell the customer: "I've sent your request to the business. You will receive a confirmation shortly."
      - CRITICAL: When you have all booking details, output a special JSON tag at the end of your message: [BOOKING:{"service": "...", "date": "...", "time": "...", "name": "...", "phone": "..."}]

      General Instructions:
      - Be helpful, polite, and concise.
      - If you don't know something, ask for their contact details so the owner can reach out.
      - For Instagram/WhatsApp, use emojis and a friendly tone.
    `;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const aiMessage = response.choices[0].message.content || "I'm sorry, I'm having trouble responding right now.";

    await saveChatMessage(businessId, conversationId, "user", userMessage);
    await saveChatMessage(businessId, conversationId, "assistant", aiMessage);

    return aiMessage;
  } catch (error: any) {
    console.error("Chat error:", error.message);
    return "Hello! I'm currently experiencing a connection issue, but we'd love to help you. Please leave your name and number!";
  }
}

export async function supportChatWithAI(userId: string, conversationId: string, userMessage: string) {
  console.log(`Support chat for user ${userId}...`);
  const client = getOpenAI();

  try {
    // Context from TRAINING.md and FAQ (simplified for the prompt)
    const supportContext = `
      GrowLocal AI Platform Info:
      - Pricing: Starter ($149/mo, 12 posts), Pro ($499/mo, 30 posts, WhatsApp, SEO), Premium ($999/mo, Unlimited, Video).
      - Setup: Owners should go to Settings to complete their profile (address, hours, services) to power the AI.
      - Social: Connect Instagram/WhatsApp in Settings. AI generates posts 3x/week by default.
      - Chatbot: Snippet in Chatbot tab. Paste in website HTML.
      - SEO: GBP management in SEO tab (Pro/Premium).
      - Reviews: Create requests in Reviews tab.
      - Bookings: Chatbot takes bookings and adds to Calendar tab.
    `;

    const history = await query(`
      SELECT role, content FROM chat_messages 
      WHERE conversation_id = '${conversationId}' 
      ORDER BY created_at ASC 
      LIMIT 10
    `);

    const messages: any[] = [
      { 
        role: "system", 
        content: `You are the GrowLocal AI Support Assistant. Your job is to help business owners use the platform.
        Context: ${supportContext}
        Instructions:
        - Be friendly, professional, and encouraging.
        - Guide them through specific steps in the dashboard.
        - If you can't solve their issue (e.g., billing error, bug, feature request), tell them you will open a support ticket for them.
        - CRITICAL: When you need to open a ticket, output this tag: [TICKET:{"subject": "...", "priority": "..."}]`
      },
      ...history,
      { role: "user", content: userMessage }
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const aiMessage = response.choices[0].message.content || "I'm here to help! How can I assist with your GrowLocal account?";

    // Save to DB (using a generic businessId or specific system id if we had one, but here we'll use 'system' for support)
    const msgId = crypto.randomUUID();
    await query(`
      INSERT INTO chat_messages (id, business_id, conversation_id, role, content)
      VALUES ('${msgId}', 'system-support', '${conversationId}', 'user', '${userMessage.replace(/'/g, "''")}')
    `);
    const aiMsgId = crypto.randomUUID();
    await query(`
      INSERT INTO chat_messages (id, business_id, conversation_id, role, content)
      VALUES ('${aiMsgId}', 'system-support', '${conversationId}', 'assistant', '${aiMessage.replace(/'/g, "''")}')
    `);

    return aiMessage;
  } catch (error: any) {
    return "I'm having a bit of trouble, but our human support team is available. Would you like me to open a ticket?";
  }
}

export async function generateSEOKeywords(businessId: string) {
  const client = getOpenAI();
  const businesses = await query(`SELECT name, category, address FROM businesses WHERE id = '${businessId}'`);
  const biz = businesses[0];
  const services = await query(`SELECT name FROM services WHERE business_id = '${businessId}'`);
  const servicesList = services.map((s: any) => s.name).join(", ");

  const prompt = `
    As an SEO expert, generate 10 high-impact local SEO keywords for "${biz.name}", a ${biz.category} in ${biz.address}.
    Consider these services: ${servicesList}.
    Include a mix of "near me", service-specific, and location-specific keywords.
    Format as a JSON array of strings.
  `;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");
    const keywords = parsed.keywords || (Array.isArray(parsed) ? parsed : []);

    // Save to SEO metrics
    const id = crypto.randomUUID();
    await query(`
      INSERT INTO seo_metrics (id, business_id, keywords, impressions, clicks, views)
      VALUES ('${id}', '${businessId}', '${JSON.stringify(keywords).replace(/'/g, "''")}', 0, 0, 0)
    `);

    return keywords;
  } catch (e) {
    return ["local " + biz.category, biz.name, biz.category + " near me"];
  }
}

export async function generateGBPContentSuggestions(businessId: string) {
  const client = getOpenAI();
  const businesses = await query(`SELECT name, category FROM businesses WHERE id = '${businessId}'`);
  const biz = businesses[0];

  const prompt = `
    Suggest 3 Google Business Profile (GBP) update ideas for "${biz.name}" (${biz.category}).
    Ideas should focus on:
    1. A new service update.
    2. A special offer.
    3. A business hour or amenity update.
    Format as a JSON array of objects with "title" and "description".
  `;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content || "{}").suggestions || [];
  } catch (e) {
    return [];
  }
}

export async function generatePromoVideo(businessId: string, content: string) {
  console.log(`Generating promo video for business ${businessId}...`);
  const client = getOpenAI();
  const businesses = await query(`SELECT name, category FROM businesses WHERE id = '${businessId}'`);
  const biz = businesses[0];

  const prompt = `
    Create a 15-second video script for a social media ad for "${biz.name}" (${biz.category}).
    Post theme: ${content}
    Include:
    1. Scene-by-scene descriptions.
    2. Text overlays for each scene.
    3. Background music style.
    4. Call to action.
    Format as JSON.
  `;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    
    return {
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-barber-cutting-hair-with-a-clipper-41005-large.mp4",
      script: JSON.parse(response.choices[0].message.content || "{}")
    };
  } catch (e) {
    return { videoUrl: "", script: {} };
  }
}
