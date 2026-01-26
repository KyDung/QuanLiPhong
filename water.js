// Thay thế toàn bộ nội dung để sử dụng Firebase thực tế

// Khai báo Firebase (giả định đã được cấu hình ở nơi khác)
// Ví dụ: import * as firebase from 'firebase/app';
// import 'firebase/database';

// Định nghĩa MEMBERS và formatDate
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

// Quản lý đổi nước
class WaterManager {
  constructor() {
    this.dbRef = firebase.database().ref("waterRotation")
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
        console.log("Đã khởi tạo dữ liệu mặc định cho đổi nước")
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
      historyList.innerHTML = "<p>Chưa có lịch sử đổi nước</p>"
      return
    }

    // Sắp xếp theo thời gian mới nhất
    const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp)

    historyList.innerHTML = sortedHistory
      .map(
        (item) => `
            <div class="history-item">
                <span><strong>${MEMBERS[item.by]}</strong> đã đổi nước</span>
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

        alert(`${MEMBERS[currentPerson]} đã hoàn thành việc đổi nước!`)
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật:", error)
      alert("Có lỗi xảy ra. Vui lòng thử lại!")
    }
  }

  setupEventListeners() {
    document.getElementById("completeBtn").addEventListener("click", () => {
      if (confirm("Xác nhận đã đổi nước?")) {
        this.completeRotation()
      }
    })
  }
}

// Khởi tạo khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  new WaterManager()
})
