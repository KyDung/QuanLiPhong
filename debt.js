// Thay thế toàn bộ nội dung để sử dụng Firebase thực tế

// Khai báo các biến firebase, MEMBERS, formatCurrency, formatDate
let firebase // Giả sử firebase được import ở đâu đó
const MEMBERS = {
  A: "Thành viên A",
  B: "Thành viên B",
  C: "Thành viên C",
  D: "Thành viên D",
}
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount)
}
const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString("vi-VN") + " " + date.toLocaleTimeString("vi-VN")
}

// Quản lý tính nợ
class DebtManager {
  constructor() {
    this.debtsRef = firebase.database().ref("debts")
    this.transactionsRef = firebase.database().ref("transactions")
    this.selectedMember = "A"
    this.init()
  }

  async init() {
    try {
      await this.loadData()
      this.setupEventListeners()
    } catch (error) {
      console.error("Lỗi khi khởi tạo:", error)
      alert("Lỗi kết nối Firebase. Vui lòng kiểm tra cấu hình!")
    }
  }

  async loadData() {
    try {
      const [debtsSnapshot, transactionsSnapshot] = await Promise.all([
        this.debtsRef.once("value"),
        this.transactionsRef.once("value"),
      ])

      this.debts = debtsSnapshot.val() || {}
      this.transactions = transactionsSnapshot.val() || {}

      this.updateMemberInfo()
      this.loadTransactionHistory()
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error)
    }
  }

  updateMemberInfo() {
    const memberName = MEMBERS[this.selectedMember]
    document.getElementById("selectedMemberName").textContent = memberName

    // Tính toán nợ
    const owedToThem = []
    const theyOwe = []

    Object.keys(this.debts).forEach((key) => {
      const amount = this.debts[key]
      if (amount > 0) {
        const [debtor, creditor] = key.split("_")

        if (creditor === this.selectedMember) {
          owedToThem.push({
            person: MEMBERS[debtor],
            amount: amount,
          })
        } else if (debtor === this.selectedMember) {
          theyOwe.push({
            person: MEMBERS[creditor],
            amount: amount,
          })
        }
      }
    })

    // Hiển thị danh sách nợ
    this.displayDebtList("owedToThem", owedToThem)
    this.displayDebtList("theyOwe", theyOwe)
  }

  displayDebtList(elementId, debtList) {
    const element = document.getElementById(elementId)

    if (debtList.length === 0) {
      element.innerHTML = "<p>Không có khoản nợ nào</p>"
      return
    }

    element.innerHTML = debtList
      .map(
        (debt) => `
            <div class="debt-item">
                <span>${debt.person}</span>
                <span class="debt-amount">${formatCurrency(debt.amount)}</span>
            </div>
        `,
      )
      .join("")
  }

  loadTransactionHistory() {
    const transactionList = document.getElementById("transactionList")
    const transactionArray = Object.values(this.transactions)

    if (transactionArray.length === 0) {
      transactionList.innerHTML = "<p>Chưa có giao dịch nào</p>"
      return
    }

    // Sắp xếp theo thời gian mới nhất
    const sortedTransactions = transactionArray.sort((a, b) => b.timestamp - a.timestamp)

    transactionList.innerHTML = sortedTransactions
      .map(
        (transaction) => `
            <div class="transaction-item">
                <div class="transaction-header">
                    <span class="transaction-title">${transaction.item}</span>
                    <span class="transaction-amount">${formatCurrency(transaction.amount)}</span>
                </div>
                <div class="transaction-details">
                    ${MEMBERS[transaction.payer]} trả tiền • Chia với: ${transaction.sharedWith.map((p) => MEMBERS[p]).join(", ")} • ${formatDate(transaction.timestamp)}
                </div>
            </div>
        `,
      )
      .join("")
  }

  async addExpense(expenseData) {
    try {
      const { itemName, amount, payer, sharedWith } = expenseData
      const totalPeople = sharedWith.length + 1 // +1 cho người trả tiền
      const perPerson = Math.floor(amount / totalPeople)

      // Tạo transaction ID
      const transactionId = Date.now().toString()

      // Thêm transaction
      const transaction = {
        id: transactionId,
        item: itemName,
        amount: amount,
        payer: payer,
        sharedWith: sharedWith,
        perPerson: perPerson,
        timestamp: Date.now(),
      }

      await this.transactionsRef.child(transactionId).set(transaction)

      // Cập nhật nợ
      const debtUpdates = {}

      sharedWith.forEach((person) => {
        if (person !== payer) {
          const debtKey = `${person}_${payer}`
          const currentDebt = this.debts[debtKey] || 0
          debtUpdates[debtKey] = currentDebt + perPerson
        }
      })

      if (Object.keys(debtUpdates).length > 0) {
        await this.debtsRef.update(debtUpdates)
      }

      // Reload data
      await this.loadData()

      alert("Đã chia tiền thành công!")
    } catch (error) {
      console.error("Lỗi khi thêm chi phí:", error)
      alert("Có lỗi xảy ra. Vui lòng thử lại!")
    }
  }

  async payDebt(debtor, creditor, amount) {
    try {
      const debtKey = `${debtor}_${creditor}`
      const currentDebt = this.debts[debtKey] || 0

      if (currentDebt < amount) {
        alert("Số tiền trả lớn hơn số nợ hiện tại!")
        return
      }

      const newDebt = currentDebt - amount

      if (newDebt === 0) {
        await this.debtsRef.child(debtKey).remove()
      } else {
        await this.debtsRef.child(debtKey).set(newDebt)
      }

      // Reload data
      await this.loadData()

      alert(`${MEMBERS[debtor]} đã trả ${formatCurrency(amount)} cho ${MEMBERS[creditor]}!`)
    } catch (error) {
      console.error("Lỗi khi trả nợ:", error)
      alert("Có lỗi xảy ra. Vui lòng thử lại!")
    }
  }

  setupEventListeners() {
    // Member selection
    document.querySelectorAll(".member-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        document.querySelectorAll(".member-item").forEach((i) => i.classList.remove("active"))
        e.currentTarget.classList.add("active")
        this.selectedMember = e.currentTarget.dataset.member
        this.updateMemberInfo()
      })
    })

    // Expense form
    document.getElementById("expenseForm").addEventListener("submit", (e) => {
      e.preventDefault()

      const itemName = document.getElementById("itemName").value
      const amount = Number.parseInt(document.getElementById("amount").value)
      const payer = document.getElementById("payer").value
      const sharedWith = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map((cb) => cb.value)
        .filter((person) => person !== payer)

      if (sharedWith.length === 0) {
        alert("Vui lòng chọn ít nhất một người để chia tiền!")
        return
      }

      if (sharedWith.length > 3) {
        alert("Chỉ được chọn tối đa 3 người để chia tiền!")
        return
      }

      this.addExpense({
        itemName,
        amount,
        payer,
        sharedWith,
      })

      // Reset form
      e.target.reset()
      document.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false))
    })

    // Manual debt form
    document.getElementById("manualDebtForm").addEventListener("submit", (e) => {
      e.preventDefault()

      const debtor = document.getElementById("debtor").value
      const creditor = document.getElementById("creditor").value
      const amount = Number.parseInt(document.getElementById("debtAmount").value)

      if (debtor === creditor) {
        alert("Người nợ và người cho nợ không thể giống nhau!")
        return
      }

      if (confirm(`Xác nhận ${MEMBERS[debtor]} trả ${formatCurrency(amount)} cho ${MEMBERS[creditor]}?`)) {
        this.payDebt(debtor, creditor, amount)
        e.target.reset()
      }
    })
  }
}

// Khởi tạo khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  new DebtManager()
})
