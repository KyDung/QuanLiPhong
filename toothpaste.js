// Thay thế toàn bộ nội dung để sử dụng Firebase thực tế

// Import Firebase (Make sure you have Firebase SDK in your project)
// For example, if using CDN:
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js"></script>

// Initialize Firebase (Replace with your actual Firebase config)
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   databaseURL: "YOUR_DATABASE_URL",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

// firebase.initializeApp(firebaseConfig);

// Define MEMBERS and formatDate
const MEMBERS = {
  A: "Người A",
  B: "Người B",
  C: "Người C",
  D: "Người D",
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString()
}

// Quản lý kem đánh răng
class ToothpasteManager {
  constructor() {
    this.dbRef = firebase.database().ref("toothpasteRotation")
    this.init()
  }

  async init() {
    try {
      // Khởi tạo dữ liệu mặc định nếu chưa có
      const snapshot = await this.dbRef.once("value")
      if (!snapshot.exists()) {
        await this.dbRef.set({
          people: ["A", "B", "C", "D"],
          currentIndex: 0,
          history: [],
        })
        console.log("Đã khởi tạo dữ liệu mặc định cho kem đánh răng")
      }

      this.loadData()
      this.setupEventListeners()
    } catch (error) {
      console.error("Lỗi khi khởi tạo:", error)
      alert("Lỗi kết nối Firebase. Vui lòng kiểm tra cấu hình!")
    }
  }

  async loadData() {
    try {
      const snapshot = await this.dbRef.once("value")
      const data = snapshot.val()

      if (data) {
        this.updateDisplay(data)
        this.loadHistory(data.history || [])
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error)
    }
  }

  updateDisplay(data) {
    const { people, currentIndex } = data
    const currentPerson = people[currentIndex]
    const previousIndex = (currentIndex - 1 + people.length) % people.length
    const nextIndex = (currentIndex + 1) % people.length

    document.getElementById("previousPerson").textContent = MEMBERS[people[previousIndex]]
    document.getElementById("currentPerson").textContent = MEMBERS[currentPerson]
    document.getElementById("nextPerson").textContent = MEMBERS[people[nextIndex]]
  }

  loadHistory(history) {
    const historyList = document.getElementById("historyList")

    if (!history || history.length === 0) {
      historyList.innerHTML = "<p>Chưa có lịch sử mua kem đánh răng</p>"
      return
    }

    // Sắp xếp theo thời gian mới nhất
    const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp)

    historyList.innerHTML = sortedHistory
      .map(
        (item) => `
            <div class="history-item">
                <span><strong>${MEMBERS[item.by]}</strong> đã mua kem đánh răng</span>
                <span>${formatDate(item.timestamp)}</span>
            </div>
        `,
      )
      .join("")
  }

  async completeRotation() {
    try {
      const snapshot = await this.dbRef.once("value")
      const data = snapshot.val()

      if (data) {
        const { people, currentIndex, history = [] } = data
        const currentPerson = people[currentIndex]
        const newIndex = (currentIndex + 1) % people.length

        // Thêm vào lịch sử
        const newHistoryItem = {
          by: currentPerson,
          timestamp: Date.now(),
        }

        const updatedHistory = [newHistoryItem, ...history]

        // Cập nhật database
        await this.dbRef.update({
          currentIndex: newIndex,
          history: updatedHistory,
        })

        // Cập nhật giao diện
        this.loadData()

        alert(`${MEMBERS[currentPerson]} đã hoàn thành việc mua kem đánh răng!`)
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật:", error)
      alert("Có lỗi xảy ra. Vui lòng thử lại!")
    }
  }

  setupEventListeners() {
    document.getElementById("completeBtn").addEventListener("click", () => {
      if (confirm("Xác nhận đã mua kem đánh răng?")) {
        this.completeRotation()
      }
    })
  }
}

// Khởi tạo khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  new ToothpasteManager()
})
