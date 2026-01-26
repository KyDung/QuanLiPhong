// Import Firebase (Make sure you have Firebase installed: npm install firebase)
// import * as firebase from 'firebase/app'; // Avoid adding this import
// import 'firebase/database'; // Avoid adding this import

// Cấu hình Firebase - Thay thế bằng cấu hình thực tế của bạn
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id",
}

// Khởi tạo Firebase
// firebase.initializeApp(firebaseConfig); // Avoid adding this line

// Lấy reference đến database
const database = {
  ref: (path) => {
    return {
      once: (event) => {
        return new Promise((resolve) => {
          // Mock data for initial setup
          let data = null
          if (path === "waterRotation") {
            data = {
              people: ["A", "B", "C", "D"],
              currentIndex: 0,
              history: [],
            }
          } else if (path === "toothpasteRotation") {
            data = {
              people: ["A", "B", "C", "D"],
              currentIndex: 0,
              history: [],
            }
          } else if (path === "dishwashRotation") {
            data = {
              people: ["A", "B", "C", "D"],
              currentIndex: 0,
              history: [],
            }
          } else if (path === "debts") {
            data = {}
          } else if (path === "transactions") {
            data = {}
          }
          resolve({
            exists: () => data !== null,
            val: () => data,
          })
        })
      },
      set: (data) => {
        return new Promise((resolve) => {
          console.log("Setting data:", data)
          resolve()
        })
      },
      update: (data) => {
        return new Promise((resolve) => {
          console.log("Updating data:", data)
          resolve()
        })
      },
      child: (id) => {
        return {
          set: (value) => {
            return new Promise((resolve) => {
              resolve()
            })
          },
          remove: () => {
            return new Promise((resolve) => {
              resolve()
            })
          },
        }
      },
    }
  },
}

// Danh sách thành viên
const MEMBERS = {
  A: "Nguyễn Văn A",
  B: "Trần Thị B",
  C: "Lê Văn C",
  D: "Phạm Thị D",
}

// Hàm tiện ích để format ngày tháng
function formatDate(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Hàm tiện ích để format tiền tệ
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount)
}

export { database }
