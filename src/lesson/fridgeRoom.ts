import type { LessonDefinition } from './types'

/** A short prediction lesson: vote first, then return to the evidence and answer at the end. */
export const fridgeRoomLesson: LessonDefinition = {
  id: 'fridge-room',
  metadata: {
    title: 'เปิดตู้เย็นแล้วห้องจะเย็นลงไหม?',
    subtitle: 'คำถามชวนคิดเรื่องพลังงาน ความร้อน และตู้เย็น',
    level: 'ฟิสิกส์พื้นฐาน',
    durationMinutes: 5,
    prerequisites: ['ความหมายของอุณหภูมิ ความร้อน และพลังงาน'],
  },
  objectives: ['อธิบายได้ว่าทำไมตู้เย็นที่เปิดประตูทิ้งไว้ไม่สามารถทำให้ห้องปิดเย็นลงได้'],
  // Session state always has a simulation state. This lesson does not render it, but supplies
  // the shared default parameters so it can use the same classroom infrastructure.
  simulations: {
    'thermal-contact': {
      id: 'thermal-contact',
      kind: 'thermal-contact',
      title: 'Thermal contact',
      params: { hotK: 308, coldK: 278, heatCapacityJPerK: 1000, timeConstantS: 2 },
      assumptions: [],
    },
  },
  questions: {
    'open-fridge': {
      id: 'open-fridge',
      kind: 'prediction',
      prompt: 'หลังผ่านไป 1 ชั่วโมง อุณหภูมิเฉลี่ยของห้องจะเป็นอย่างไร?',
      options: [
        { id: 'A', text: 'ลดลง 🥶 เพราะตู้เย็นปล่อยความเย็นออกมา' },
        { id: 'B', text: 'เท่าเดิม 😐 เพราะความร้อนแค่ย้ายไปมา' },
        { id: 'C', text: 'สูงขึ้น 🥵 เพราะสุดท้ายตู้เย็นปล่อยความร้อนมากกว่าที่ดูดออก' },
        { id: 'D', text: 'แล้วแต่ตั้งตู้เย็นไว้กี่องศา' },
      ],
      correctOptionId: 'C',
      explanation:
        'ตู้เย็นดูดความร้อนจากภายในตู้ แล้วคายความร้อนนั้นออกด้านหลังตู้ แต่ยังต้องใช้พลังงานไฟฟ้ากับคอมเพรสเซอร์ด้วย พลังงานไฟฟ้านั้นลงเอยเป็นความร้อนในห้องเช่นกัน ดังนั้นในห้องปิดสนิท ความร้อนที่ตู้เย็นคายออกมามากกว่าความร้อนที่มันดูดเข้าไป อุณหภูมิเฉลี่ยของห้องจึงสูงขึ้น',
    },
  },
  steps: [
    {
      id: 'prediction',
      title: 'ร้อนมาก! ไม่มีแอร์ ทำแบบนี้ช่วยได้ไหม?',
      minutes: 2,
      blocks: [
        {
          id: 'midnight-fridge-photo',
          type: 'image',
          src: '/lesson-assets/midnight-breeze-by-the-fridge.png',
          alt: 'เด็กนั่งหน้าตู้เย็นที่เปิดประตูอยู่ในห้องตอนกลางคืน',
          fit: 'cover',
        },
        {
          id: 'room-context',
          type: 'text',
          role: 'subtitle',
          text: 'กรุงเทพ · ห้องปิดสนิท · $35^\\circ C$ · เปิดตู้เย็นทิ้งไว้และเสียบปลั๊กตามปกติ',
          highlights: ['$35^\\circ C$'],
          animation: 'fade',
        },
        { id: 'fridge-question', type: 'question', questionId: 'open-fridge', answerTiming: 'deferred' },
      ],
    },
    {
      id: 'answer',
      title: 'เฉลย: ห้องร้อนขึ้น',
      minutes: 3,
      blocks: [
        { id: 'answer-lead', type: 'concept', tone: 'key', text: 'ความร้อนที่คายออกด้านหลังตู้เย็น = ความร้อนที่ดูดจากในตู้ + พลังงานไฟฟ้าที่ใช้' },
        { id: 'fridge-review', type: 'question-review', questionId: 'open-fridge' },
        { id: 'answer-explanation', type: 'explanation', title: 'ทำไมจึงเป็นเช่นนั้น?', paragraphs: ['ตู้เย็นไม่ได้สร้างความเย็น แต่ใช้ไฟฟ้าสูบความร้อนออกจากภายในตู้และปล่อยออกด้านหลัง เมื่อเปิดประตูทิ้งไว้ ความร้อนทั้งหมดกลับเข้าห้อง พร้อมความร้อนเพิ่มจากพลังงานไฟฟ้าที่คอมเพรสเซอร์ใช้'] },
      ],
    },
  ],
  summary: { heading: 'สรุป', rows: [{ law: 'คำตอบ', question: 'เปิดตู้เย็นในห้องปิดไม่ได้ทำให้ห้องเย็นลง', note: 'พลังงานไฟฟ้ากลายเป็นความร้อนเพิ่มในห้อง' }] },
}
