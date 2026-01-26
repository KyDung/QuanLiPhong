// Import the Firebase SDK
import firebase from "firebase/app"
import "firebase/database"

// Cấu hình Firebase với thông tin thực tế của bạn
const firebaseConfig = {
  apiKey: "AIzaSyBb9dnBAgu7YBSnaRbty5CxPzM3Dvj-gi0",
  authDomain: "webtinhno.firebaseapp.com",
  databaseURL: "https://webtinhno-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webtinhno",
  storageBucket: "webtinhno.firebasestorage.app",
  messagingSenderId: "816939347254",
  appId: "1:816939347254:web:b684dcbbcb2bbaf4c95797",
  measurementId: "G-QJ1LS1CT3N",
}

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig)

// Lấy reference đến database
const database = firebase.database()

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
