import './style.css'

const apiKey = import.meta.env.VITE_OPENAI_API_KEY

const app = document.querySelector('#app')
app.innerHTML = `
  <div>
    <h1>🍽️ 저녁 메뉴 추천 챗봇</h1>

    <details id="devPanel" class="dev-panel">
      <summary>🛠️ 개발자 모드: 프롬프트 편집/테스트</summary>
      <div class="dev-body">
        <label for="promptEditor" class="dev-label">System Prompt</label>
        <textarea id="promptEditor" class="prompt-editor" rows="8" spellcheck="false"></textarea>
        <div class="dev-actions">
          <button id="applyPromptBtn">프롬프트 적용 ✅</button>
          <button id="resetPromptBtn">프롬프트 초기화 ♻️</button>
        </div>
        <small id="promptStatus" class="prompt-status"></small>
      </div>
    </details>

    <div class="chat-container">
      <div id="messages" class="messages"></div>
      <div class="input-row">
        <input id="userInput" type="text" placeholder="💬 예: 매콤한 한식, 1만원대, 회사 근처" />
        <button id="sendBtn">보내기 ✉️</button>
      </div>
    </div>
    <p class="read-the-docs">취향이나 예산, 위치(동네 정도)를 적어주세요.</p>
  </div>
`

const messagesEl = document.getElementById('messages')
const inputEl = document.getElementById('userInput')
const sendBtn = document.getElementById('sendBtn')

function appendMessage(text, role) {
  const div = document.createElement('div')
  div.className = `message ${role}`
  const prefix = role === 'user' ? '🙂' : '🍳'
  div.textContent = `${prefix} ${text}`
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function guardApiKey() {
  if (!apiKey || typeof apiKey !== 'string') {
    appendMessage('환경변수 VITE_OPENAI_API_KEY가 설정되지 않았습니다. Netlify/Vite에 설정해주세요.', 'bot')
    return false
  }
  return true
}

const defaultSystemPrompt = `너는 사용자의 취향, 예산, 위치(대략적) 정보를 바탕으로 저녁 메뉴를 3가지로 추천하는 도우미야.\n- 각 추천은 간단한 이유와 예상 가격대, 대체 옵션 1개를 포함해.\n- 너무 장문으로 쓰지 말고 목록으로 간결하게 답해.\n- 항목 앞에 가벼운 이모지(🍜, 🥗, 🍣 등)를 붙여 친근하게.`
let currentSystemPrompt = localStorage.getItem('dev.systemPrompt') || defaultSystemPrompt

async function suggestDinner(userText) {

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: currentSystemPrompt },
      { role: 'user', content: `내 조건: ${userText}` }
    ],
    temperature: 0.7
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`API 오류: ${res.status} ${err}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim() || '추천을 가져오지 못했습니다.'
  return text
}

async function handleSend() {
  const text = inputEl.value.trim()
  if (!text) return
  appendMessage(text, 'user')
  inputEl.value = ''
  if (!guardApiKey()) return
  const thinkingId = `thinking-${Date.now()}`
  const thinking = document.createElement('div')
  thinking.className = 'message bot'
  thinking.id = thinkingId
  thinking.textContent = '🤔 생각 중…'
  messagesEl.appendChild(thinking)
  messagesEl.scrollTop = messagesEl.scrollHeight
  try {
    const reply = await suggestDinner(text)
    thinking.remove()
    appendMessage(reply, 'bot')
  } catch (e) {
    thinking.remove()
    appendMessage(`문제가 발생했어요: ${e.message}`, 'bot')
  }
}

sendBtn.addEventListener('click', handleSend)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend()
})

// 초기 인사
appendMessage('안녕하세요! 저녁 메뉴 추천을 도와드릴게요 😊\n취향/예산/위치를 알려주시면 맞춤 추천 드릴게요.', 'bot')

// 개발자 모드: 프롬프트 편집/적용/초기화
const promptEditor = document.getElementById('promptEditor')
const applyPromptBtn = document.getElementById('applyPromptBtn')
const resetPromptBtn = document.getElementById('resetPromptBtn')
const promptStatus = document.getElementById('promptStatus')

if (promptEditor) {
  promptEditor.value = currentSystemPrompt
}

function showPromptStatus(text) {
  if (!promptStatus) return
  promptStatus.textContent = text
  promptStatus.style.opacity = '1'
  setTimeout(() => {
    promptStatus.style.opacity = '0.6'
  }, 1200)
}

applyPromptBtn?.addEventListener('click', () => {
  const text = promptEditor.value.trim()
  if (!text) {
    showPromptStatus('프롬프트가 비어있습니다.')
    return
  }
  currentSystemPrompt = text
  localStorage.setItem('dev.systemPrompt', currentSystemPrompt)
  showPromptStatus('적용 완료! 다음 요청부터 사용됩니다.')
})

resetPromptBtn?.addEventListener('click', () => {
  currentSystemPrompt = defaultSystemPrompt
  localStorage.removeItem('dev.systemPrompt')
  if (promptEditor) promptEditor.value = defaultSystemPrompt
  showPromptStatus('기본 프롬프트로 초기화했습니다.')
})
