const ChatHistory = require('../models/ChatHistory');
const Pet = require('../models/Pet');
const { v4: uuidv4 } = require('crypto');

// Helper: Generate session ID
const generateSessionId = () => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Simulate AI response (replace with actual AI API call)
const getAIResponse = async (messages, petInfo) => {
  // In production, call your AI API (OpenAI, Gemini, etc.)
  // This is a structured mock that demonstrates the response format
  const lastMessage = messages[messages.length - 1].content.toLowerCase();

  let severity = 'normal';
  let recommendation = 'self_care';
  let symptoms = [];
  let response = '';

  // Simple keyword-based triage (replace with real AI)
  const emergencyKeywords = ['co giật', 'chảy máu nhiều', 'không thở', 'ngộ độc', 'tai nạn', 'bất tỉnh'];
  const severeKeywords = ['nôn liên tục', 'tiêu chảy nặng', 'sốt cao', 'bỏ ăn 2 ngày', 'khó thở'];
  const moderateKeywords = ['nôn', 'tiêu chảy', 'ho', 'sốt', 'bỏ ăn', 'mệt mỏi', 'ngứa'];
  const mildKeywords = ['hắt hơi', 'gãi', 'ăn ít', 'lười', 'thay đổi lông'];

  if (emergencyKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'emergency';
    recommendation = 'emergency';
    response = `⚠️ **KHẨN CẤP**: Triệu chứng bạn mô tả cần được xử lý NGAY LẬP TỨC. Hãy đưa ${petInfo?.name || 'thú cưng'} đến phòng khám thú y gần nhất hoặc gọi đường dây nóng thú y. KHÔNG tự ý điều trị tại nhà.\n\n📞 Bạn có muốn tôi tìm bác sĩ thú y gần nhất không?`;
  } else if (severeKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'severe';
    recommendation = 'urgent_vet';
    response = `🔴 Triệu chứng của ${petInfo?.name || 'thú cưng'} khá nghiêm trọng. Bạn nên đưa đến bác sĩ thú y trong vòng 24 giờ tới.\n\n**Trong khi chờ đợi:**\n- Đảm bảo cung cấp đủ nước\n- Giữ thú cưng ở nơi yên tĩnh\n- Theo dõi sát các triệu chứng\n\n📋 Bạn có muốn đặt lịch khám ngay không?`;
  } else if (moderateKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'moderate';
    recommendation = 'schedule_vet';
    response = `🟡 Triệu chứng của ${petInfo?.name || 'thú cưng'} cần theo dõi. Nếu kéo dài hơn 48 giờ, bạn nên đưa đến bác sĩ thú y.\n\n**Gợi ý chăm sóc:**\n- Cho ăn nhẹ, dễ tiêu hóa\n- Đảm bảo uống đủ nước\n- Ghi lại tần suất triệu chứng\n\nHãy cho tôi biết nếu có thêm triệu chứng khác.`;
  } else if (mildKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'mild';
    recommendation = 'monitor';
    response = `🟢 Triệu chứng nhẹ, có thể theo dõi tại nhà. Nếu không cải thiện sau 3-5 ngày, hãy liên hệ bác sĩ.\n\n**Mẹo chăm sóc:**\n- Giữ vệ sinh sạch sẽ\n- Đảm bảo dinh dưỡng đầy đủ\n- Theo dõi thay đổi hành vi`;
  } else {
    response = `Xin chào! Tôi là trợ lý AI của PAWRENT 🐾\n\nTôi có thể giúp bạn:\n- Tư vấn khi thú cưng có triệu chứng bất thường\n- Gợi ý chăm sóc phù hợp\n- Đề xuất đi khám bác sĩ khi cần\n\nHãy mô tả tình trạng sức khỏe ${petInfo?.name || 'thú cưng'} của bạn.`;
  }

  return { response, severity, recommendation, symptoms };
};

// @desc    Start chat session / Send message
// @route   POST /api/v1/chat
// @access  Private (premium)
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId, petId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tin nhắn.',
      });
    }

    let petInfo = null;
    if (petId) {
      petInfo = await Pet.findOne({ _id: petId, owner: req.user.id });
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
      .select('sessionId pet severity recommendation messages.0 createdAt updatedAt');

    res.status(200).json({
      success: true,
      count: chats.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: chats,
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
