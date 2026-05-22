const ChatHistory = require('../models/ChatHistory');
const Pet = require('../models/Pet');
const { v4: uuidv4 } = require('crypto');
const Groq = require('groq-sdk');

// Initialize Groq lazily (only when needed)
let groq = null;

const getGroqClient = () => {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
};

// Helper: Generate session ID
const generateSessionId = () => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Extract severity and recommendation from AI response
const parseAIResponse = (text) => {
  let severity = 'normal';
  let recommendation = 'self_care';

  const lowerText = text.toLowerCase();

  // Detect severity keywords
  if (lowerText.includes('khẩn cấp') || lowerText.includes('ngay lập tức') || lowerText.includes('emergency')) {
    severity = 'emergency';
    recommendation = 'emergency';
  } else if (lowerText.includes('nghiêm trọng') || lowerText.includes('trong 24 giờ') || lowerText.includes('urgent')) {
    severity = 'severe';
    recommendation = 'urgent_vet';
  } else if (lowerText.includes('cần theo dõi') || lowerText.includes('schedule') || lowerText.includes('đặt lịch')) {
    severity = 'moderate';
    recommendation = 'schedule_vet';
  } else if (lowerText.includes('nhẹ') || lowerText.includes('monitor') || lowerText.includes('theo dõi')) {
    severity = 'mild';
    recommendation = 'monitor';
  }

  return { severity, recommendation };
};

// Helper: Get AI response from Groq
const getAIResponse = async (messages, petInfo) => {
  try {
    const systemMessage = `Bạn là trợ lý AI chăm sóc thú cưng chuyên nghiệp của PAWRENT. 
    ${petInfo ? `Thú cưng: ${petInfo.name} (${petInfo.species}, ${petInfo.breed || 'không rõ'}), 
    Tuổi: ${petInfo.age?.years || 0} tuổi ${petInfo.age?.months || 0} tháng,
    Tình trạng sức khỏe: ${petInfo.healthStatus}, 
    Dị ứng: ${petInfo.allergies?.join(', ') || 'Không'}` : ''}

    HƯỚNG DẪN PHẢN HỒI:
    - Hãy tư vấn chăm sóc thú cưng một cách chuyên nghiệp
    - Nếu triệu chứng KHẨN CẤP (co giật, không thở, chảy máu): hãy nói "KHẨN CẤP" và hướng tới bác sĩ ngay
    - Nếu triệu chứng NGHIÊM TRỌNG (sốt cao, nôn liên tục, bỏ ăn 2 ngày): hãy nói "NGHIÊM TRỌNG" và gợi ý trong 24 giờ
    - Nếu triệu chứng TRUNG BÌNH (nôn, tiêu chảy, ho): hãy nói "CẦN THEO DÕI" và gợi ý nếu kéo dài 48 giờ
    - Nếu triệu chứng NHẸ (hắt hơi, gãi, ăn ít): hãy nói "NHẸ" và gợi ý theo dõi tại nhà
    - Trả lời bằng TIẾNG VIỆT
    - Ngắn gọn, rõ ràng, dễ hiểu`;

    // Convert messages to Groq format
    const groqMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // Add system message at the beginning
    groqMessages.unshift({
      role: 'system',
      content: systemMessage,
    });

    // Call Groq API
    const response = await getGroqClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile', // or 'llama2-70b-4096', 'gemma-7b-it'
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = response.choices[0].message.content;

    // Parse severity and recommendation
    const { severity, recommendation } = parseAIResponse(responseText);

    return {
      response: responseText,
      severity,
      recommendation,
      symptoms: [],
    };
  } catch (error) {
    console.error('❌ Groq Error:', error.message);
    throw error;
  }
};

// @desc    Start chat session / Send message
// @route   POST /api/v1/chat
// @access  Private (premium)
exports.sendMessage = async (req, res, next) => {
  try {
    // Check if API key is configured
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI Chatbot chưa được kích hoạt. Vui lòng liên hệ admin để setup Groq API key.',
        code: 'AI_SERVICE_UNAVAILABLE',
      });
    }

    const { message, sessionId, petId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tin nhắn.',
      });
    }

    let petInfo = null;
    if (petId) {
      petInfo = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    }

    let chat;
    const newSessionId = sessionId || generateSessionId();

    if (sessionId) {
      // Continue existing session
      chat = await ChatHistory.findOne({
        sessionId,
        user: req.user.id,
        isActive: true,
      });
    }

    if (!chat) {
      // New session
      chat = new ChatHistory({
        user: req.user.id,
        pet: petId,
        sessionId: newSessionId,
        messages: [],
      });

      // Add system prompt
      chat.messages.push({
        role: 'system',
        content: `Bạn là trợ lý AI chăm sóc thú cưng PAWRENT. 
        ${petInfo ? `Thông tin thú cưng: ${petInfo.name}, ${petInfo.species}, ${petInfo.breed || ''}, 
        ${petInfo.age ? `${petInfo.age.years} tuổi ${petInfo.age.months} tháng` : ''}, 
        Tình trạng: ${petInfo.healthStatus}, Dị ứng: ${petInfo.allergies?.join(', ') || 'Không'}` : ''}`,
      });
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message,
    });

    // Get AI response
    const aiResult = await getAIResponse(chat.messages, petInfo);

    // Add AI response
    chat.messages.push({
      role: 'assistant',
      content: aiResult.response,
    });

    chat.severity = aiResult.severity;
    chat.recommendation = aiResult.recommendation;
    if (aiResult.symptoms.length > 0) {
      chat.symptoms = aiResult.symptoms;
    }

    await chat.save();

    res.status(200).json({
      success: true,
      data: {
        sessionId: newSessionId,
        message: aiResult.response,
        severity: aiResult.severity,
        recommendation: aiResult.recommendation,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chat history
// @route   GET /api/v1/chat/history
// @access  Private
exports.getChatHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const total = await ChatHistory.countDocuments({ user: req.user.id });
    const chats = await ChatHistory.find({ user: req.user.id })
      .populate('pet', 'name species avatar')
      .sort('-updatedAt')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('sessionId pet severity recommendation messages createdAt updatedAt');

    // Map response to only include last message and message count
    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      sessionId: chat.sessionId,
      pet: chat.pet,
      severity: chat.severity,
      recommendation: chat.recommendation,
      messageCount: chat.messages.length,
      lastMessage: chat.messages[chat.messages.length - 1] || null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedChats.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: formattedChats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single chat session
// @route   GET /api/v1/chat/:sessionId
// @access  Private
exports.getChatSession = async (req, res, next) => {
  try {
    const chat = await ChatHistory.findOne({
      sessionId: req.params.sessionId,
      user: req.user.id,
    }).populate('pet', 'name species breed avatar');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên chat.',
      });
    }

    res.status(200).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    End chat session
// @route   PUT /api/v1/chat/:sessionId/end
// @access  Private
exports.endChatSession = async (req, res, next) => {
  try {
    const chat = await ChatHistory.findOneAndUpdate(
      { sessionId: req.params.sessionId, user: req.user.id },
      { isActive: false },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên chat.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã kết thúc phiên chat.',
    });
  } catch (error) {
    next(error);
  }
};
