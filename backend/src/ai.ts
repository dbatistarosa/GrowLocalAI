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

export async function generateSocialPosts(businessId: string, category: string, businessName: string) {
  console.log(`Generating posts for ${businessName} (${category})...`);
  const client = getOpenAI();
  let posts: any[] = [];

  const prompt = `
    You are a professional social media manager for a local business called "${businessName}".
    The business category is "${category}".
    Generate 3 engaging social media posts for this business.
    Each post should include:
    1. A short, catchy caption with hashtags.
    2. A prompt for an image generator (DALL-E) that would perfectly accompany this post.

    Format the output as a JSON array of objects:
    [
      {
        "content": "caption text here",
        "imagePrompt": "image prompt here"
      },
      ...
    ]
    Only return the JSON.
  `;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant that generates social media content." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content generated");

    const parsed = JSON.parse(content);
    posts = parsed.posts || (Array.isArray(parsed) ? parsed : [parsed]);
  } catch (error: any) {
    console.error("OpenAI API error (falling back to mock data):", error.message);
    posts = [
      {
        content: `Check out the latest styles at ${businessName}! Best ${category} in town. #local #style`,
        imagePrompt: `A busy ${category} with customers.`
      },
      {
        content: `We are open late this weekend at ${businessName}. Come visit us! #openlate #localbusiness`,
        imagePrompt: `The storefront of ${businessName} at night.`
      },
      {
        content: `Quality you can trust at ${businessName}. Your favorite ${category}. #quality #service`,
        imagePrompt: `Close up of tools used in a ${category}.`
      }
    ];
  }

  const generatedPosts = [];

  for (const post of posts) {
    console.log(`Processing post: ${post.content.substring(0, 30)}...`);
    
    let imageUrl = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800"; // Fallback image
    try {
      const imageResponse = await client.images.generate({
        model: "dall-e-3",
        prompt: `A high-quality professional social media photo for a ${category} business called "${businessName}". ${post.imagePrompt}. Professional photography, bright lighting, realistic.`,
        n: 1,
        size: "1024x1024",
      });
      if (imageResponse.data && imageResponse.data.length > 0) {
        imageUrl = imageResponse.data[0].url || imageUrl;
      }
    } catch (imgErr: any) {
      console.error("Image generation failed (using fallback):", imgErr.message);
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

export async function chatWithAI(businessId: string, conversationId: string, userMessage: string) {
  console.log(`Chatting for business ${businessId}, conversation ${conversationId}...`);
  const client = getOpenAI();

  try {
    const businesses = await query(`SELECT name, category, chatbot_config FROM businesses WHERE id = '${businessId}'`);
    if (!businesses || businesses.length === 0) throw new Error("Business not found");

    const { name, category, chatbot_config } = businesses[0];
    const config = chatbot_config ? JSON.parse(chatbot_config) : {};

    // Fetch conversation history
    const history = await query(`
      SELECT role, content FROM chat_messages 
      WHERE conversation_id = '${conversationId}' 
      ORDER BY created_at ASC 
      LIMIT 10
    `);

    const messages: any[] = [
      { 
        role: "system", 
        content: `You are a helpful customer service assistant for "${name}", a local business in the "${category}" category. 
        Business Info: ${JSON.stringify(config)}.
        Answer the customer's questions politely and concisely based on the business information provided. 
        If you don't know the answer, ask them to leave their contact details so the owner can get back to them.`
      },
      ...history,
      { role: "user", content: userMessage }
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const aiMessage = response.choices[0].message.content || "I'm sorry, I'm having trouble responding right now.";

    // Save user message
    const userMsgId = crypto.randomUUID();
    await query(`
      INSERT INTO chat_messages (id, business_id, conversation_id, role, content)
      VALUES ('${userMsgId}', '${businessId}', '${conversationId}', 'user', '${userMessage.replace(/'/g, "''")}')
    `);

    // Save AI message
    const aiMsgId = crypto.randomUUID();
    await query(`
      INSERT INTO chat_messages (id, business_id, conversation_id, role, content)
      VALUES ('${aiMsgId}', '${businessId}', '${conversationId}', 'assistant', '${aiMessage.replace(/'/g, "''")}')
    `);

    return aiMessage;
  } catch (error: any) {
    console.error("Chat error:", error.message);
    return "I'm sorry, I'm experiencing some technical difficulties. Please try again later.";
  }
}
