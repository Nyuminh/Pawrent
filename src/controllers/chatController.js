const ChatHistory = require('../models/ChatHistory');
const Pet = require('../models/Pet');
const { v4: uuidv4 } = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI (only if API key is provided)
let genAI = null;
if (process.env.GOOGLE_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
}

// Helper: Generate session ID
const generateSessionId = () => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Simple keyword-based AI response (fallback)
const getSimpleAIResponse = (message, petInfo) => {
  const lastMessage = message.toLowerCase();
  let severity = 'normal';
  let recommendation = 'self_care';
  let response = '';

  // Keyword analysis
  const emergencyKeywords = ['co giật', 'chảy máu nhiều', 'không thở', 'ngộ độc', 'tai nạn', 'bất tỉnh'];
  const severeKeywords = ['nôn liên tục', 'tiêu chảy nặng', 'sốt cao', 'bỏ ăn 2 ngày', 'khó thở'];
  const moderateKeywords = ['nôn', 'tiêu chảy', 'ho', 'sốt', 'bỏ ăn', 'mệt mỏi', 'ngứa'];
  const mildKeywords = ['hắt hơi', 'gãi', 'ăn ít', 'lười', 'thay đổi lông'];

  if (emergencyKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'emergency';
    recommendation = 'emergency';
    response = `⚠️ **KHẨN CẤP**: Triệu chứng bạn mô tả cần được xử lý NGAY LẬP TỨC. Hãy đưa ${petInfo?.name || 'thú cưng'} đến phòng khám thú y gần nhất. KHÔNG tự ý điều trị tại nhà.\n\n📞 Bạn có muốn tôi tìm bác sĩ thú y gần nhất không?`;
  } else if (severeKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'severe';
    recommendation = 'urgent_vet';
    response = `🔴 Triệu chứng của ${petInfo?.name || 'thú cưng'} khá nghiêm trọng. Bạn nên đưa đến bác sĩ thú y trong vòng 24 giờ tới.\n\n**Trong khi chờ đợi:**\n- Đảm bảo cung cấp đủ nước\n- Giữ thú cưng ở nơi yên tĩnh\n- Theo dõi sát các triệu chứng`;
  } else if (moderateKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'moderate';
    recommendation = 'schedule_vet';
    response = `🟡 Triệu chứng của ${petInfo?.name || 'thú cưng'} cần theo dõi. Nếu kéo dài hơn 48 giờ, bạn nên đưa đến bác sĩ thú y.\n\n**Gợi ý chăm sóc:**\n- Cho ăn nhẹ, dễ tiêu hóa\n- Đảm bảo uống đủ nước\n- Ghi lại tần suất triệu chứng`;
  } else if (mildKeywords.some((k) => lastMessage.includes(k))) {
    severity = 'mild';
    recommendation = 'monitor';
    response = `🟢 Triệu chứng nhẹ, có thể theo dõi tại nhà. Nếu không cải thiện sau 3-5 ngày, hãy liên hệ bác sĩ.\n\n**Mẹo chăm sóc:**\n- Giữ vệ sinh sạch sẽ\n- Đảm bảo dinh dưỡng đầy đủ\n- Theo dõi thay đổi hành vi`;
  } else {
    response = `Xin chào! Tôi là trợ lý AI của PAWRENT 🐾\n\nTôi có thể giúp bạn:\n- Tư vấn khi thú cưng có triệu chứng bất thường\n- Gợi ý chăm sóc phù hợp\n- Đề xuất đi khám bác sĩ khi cần\n\nHãy mô tả tình trạng sức khỏe ${petInfo?.name || 'thú cưng'} của bạn.`;
  }

  return { response, severity, recommendation, symptoms: [] };
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

// Helper: Get AI response from Gemini
const getAIResponse = async (messages, petInfo) => {
  // If API key is not configured, use simple keyword-based AI
  if (!genAI || !process.env.GOOGLE_API_KEY) {
    console.warn('⚠️ GOOGLE_API_KEY not configured. Using fallback keyword-based AI.');
    const lastMessage = messages[messages.length - 1].content;
    return getSimpleAIResponse(lastMessage, petInfo);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Prepare system context
    const systemContext = `Bạn là trợ lý AI chăm sóc thú cưng chuyên nghiệp của PAWRENT. 
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

    // Convert chat history to Gemini format
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Start chat session
    const chat = model.startChat({
      history: history.slice(0, -1), // Remove last user message to add it fresh
    });

    // Send message and get response
    const lastUserMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastUserMessage);
    const responseText = result.response.text();

    // Parse severity and recommendation
    const { severity, recommendation } = parseAIResponse(responseText);

    return {
      response: responseText,
      severity,
      recommendation,
      symptoms: [],
    };
  } catch (error) {
    console.error('❌ Gemini AI Error:', error.message);
    console.warn('⚠️ Falling back to keyword-based AI...');

    // Fallback to simple keyword-based AI
    const lastMessage = messages[messages.length - 1].content;
    return getSimpleAIResponse(lastMessage, petInfo);
  }
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
