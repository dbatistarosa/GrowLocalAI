// FAQ Page Component — In-App Help for Business Owners
// Insert this as a tab in the Dashboard or make it a standalone /faq route

const faqData = [
  {
    tier: "all",
    category: "Getting Started",
    questions: [
      {
        q: "How do I set up my business profile?",
        a: "Go to Settings → Business Profile. Fill in your business name, phone, address, hours, and upload your logo and photos. This information powers all AI-generated content."
      },
      {
        q: "How do I connect my social media accounts?",
        a: "Go to Settings → Connected Accounts. Click 'Connect' next to Instagram, Google Business Profile, or WhatsApp and follow the authorization flow."
      },
      {
        q: "How do AI social posts work?",
        a: "We generate posts based on your business category and profile. You can preview, approve, reject, or reschedule each post before it goes live."
      },
      {
        q: "Can I customize what the AI posts?",
        a: "Yes! You can edit any post's caption before approving it. The AI learns from your edits over time."
      }
    ]
  },
  {
    tier: "all",
    category: "Social Media Manager",
    questions: [
      {
        q: "How many posts do I get per month?",
        a: "Starter: 12 posts/mo. Pro: 30 posts/mo. Premium: Unlimited posts + video creation. Your current usage is shown in the dashboard."
      },
      {
        q: "Can I schedule posts for specific times?",
        a: "Yes. After generating posts, you can approve and schedule them to specific dates and times directly from the Social Media tab."
      },
      {
        q: "Does the AI generate images for my posts?",
        a: "Yes, the AI creates custom images using DALL-E based on your business category. You can also upload your own images in Settings."
      },
      {
        q: "Can I create videos?",
        a: "Video creation is available on the Premium plan only. The AI generates short promotional videos for your services."
      },
      {
        q: "What Instagram features are available?",
        a: "All plans: Connect Instagram and auto-post. Pro/Premium: Instagram DM chatbot that automatically responds to customer inquiries."
      }
    ]
  },
  {
    tier: "all",
    category: "Chatbot & Leads",
    questions: [
      {
        q: "How do I add the chatbot to my website?",
        a: "Go to the Chatbot tab in your dashboard. Copy the embed snippet and paste it into your website's HTML before the closing </body> tag."
      },
      {
        q: "What does the chatbot know about my business?",
        a: "The chatbot uses your business profile info and any custom knowledge base you set up in the Chatbot tab. You can add FAQs, service details, pricing, and hours."
      },
      {
        q: "Does the chatbot take bookings?",
        a: "On Pro and Premium plans, the chatbot can take reservations. It asks for date, time, service, and contact info, then adds it to your calendar."
      },
      {
        q: "Can I use WhatsApp with the chatbot?",
        a: "Yes! Connect your WhatsApp Business account in Settings → Connected Accounts. Customers can message you on WhatsApp and the bot handles inquiries and bookings."
      },
      {
        q: "What happens when the chatbot can't answer?",
        a: "The chatbot collects the customer's contact info and notifies you via email and dashboard so you can follow up personally."
      }
    ]
  },
  {
    tier: "pro_premium",
    category: "Google Business Profile & SEO",
    questions: [
      {
        q: "How do I connect my Google Business Profile?",
        a: "Go to Settings → Connected Accounts → Google. Click 'Connect' and authorize access to your Google Business Profile."
      },
      {
        q: "What SEO reports do I get?",
        a: "Your SEO dashboard shows: search impressions, Google Maps views, website clicks, direction requests, phone calls, keyword rankings, and competitor data (Premium)."
      },
      {
        q: "Does GrowLocal manage my GBP listing?",
        a: "Yes! You can update business info, hours, add photos, and respond to reviews directly from your dashboard. Changes sync to Google."
      },
      {
        q: "How does the AI help my local SEO?",
        a: "The AI generates keywords from your services and location, optimizes your posts for local search, and tracks your ranking changes over time."
      }
    ]
  },
  {
    tier: "all",
    category: "Reviews",
    questions: [
      {
        q: "How do review requests work?",
        a: "After serving a customer, create a review request in the Reviews tab. We generate a shareable link. Send it via text or email. When they click it, they'll be taken to a page to leave a star rating and review."
      },
      {
        q: "Where do reviews go?",
        a: "Reviews are displayed in your dashboard and can be pushed to your Google Business Profile."
      },
      {
        q: "Can I respond to reviews?",
        a: "Yes, you can respond to reviews directly from the Reviews tab in your dashboard."
      }
    ]
  },
  {
    tier: "all",
    category: "Calendar & Bookings",
    questions: [
      {
        q: "How do I use the calendar?",
        a: "The Calendar tab shows all your reservations. You can manually add bookings (for phone calls), and the chatbot automatically adds online bookings."
      },
      {
        q: "Can I set my availability?",
        a: "Yes. Go to Settings → Services to set your operating hours, service durations, and buffer times between appointments."
      },
      {
        q: "Does the calendar track my income?",
        a: "On the Premium plan, the calendar shows income from completed bookings. Each service has a price, and total revenue is calculated automatically."
      }
    ]
  },
  {
    tier: "all",
    category: "Billing & Subscription",
    questions: [
      {
        q: "How do I upgrade or downgrade my plan?",
        a: "Go to Settings → Subscription to see your current plan and available upgrades. Click 'Change Plan' and follow the checkout process."
      },
      {
        q: "How do I see my usage?",
        a: "Your dashboard header shows current usage: e.g., '12/12 posts used this month'. Usage resets on your billing date."
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes, go to Settings → Subscription and click 'Cancel Subscription'. Your access continues until the end of the billing period."
      }
    ]
  }
];

export default faqData;
