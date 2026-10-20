// Trang Tính nợ. Cần common.js được nạp trước.

const MAX_SHARE_MEMBERS = MEMBER_IDS.length - 1;
const NO_ACCOUNT_TEXT = "Chưa cập nhật";
const MIN_AMOUNT = 1000;

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
function formatNumberInput(value) {
  if (value === null || value === undefined) return "";
  const digits = value.toString().replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function parseNumberInput(value) {
  if (!value) return 0;
  const digits = value.toString().replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function hasBankAccount(member) {
  return Boolean(member.account && member.bankCode);
}

function generateVietQR(bankCode, accountNumber, amount = "", message = "") {
  let url = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png`;
  const params = new URLSearchParams();
  if (amount) params.append("amount", amount);
  if (message) params.append("addInfo", message);
  if (params.toString()) url += "?" + params.toString();
  return url;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Sinh danh sách thành viên cho sidebar, các ô chọn và checkbox từ MEMBERS
function renderMemberControls() {
  const options = MEMBER_IDS.map(
    (id) => `<option value="${id}">${escapeHtml(MEMBERS[id].name)}</option>`,
  ).join("");

  document.getElementById("memberList").innerHTML = MEMBER_IDS.map(
    (id, index) => `
      <div class="member-item${index === 0 ? " active" : ""}" data-member="${id}" data-initial="${escapeHtml(MEMBERS[id].name.charAt(0))}">
        <span class="member-name">${escapeHtml(MEMBERS[id].name)}</span>
      </div>`,
  ).join("");

  document.getElementById("payer").innerHTML = options;
  ["debtor", "creditor", "lender", "borrower"].forEach((id) => {
    document.getElementById(id).insertAdjacentHTML("beforeend", options);
  });

  document.getElementById("shareGroup").innerHTML = MEMBER_IDS.map(
    (id) => `
      <label><input class="share-checkbox" type="checkbox" value="${id}" /> ${escapeHtml(MEMBERS[id].name)}</label>`,
  ).join("");

  document.getElementById("expenseOffsetCustom").innerHTML = MEMBER_IDS.map(
    (id) => `
      <label class="offset-custom-option">
        <input class="offset-checkbox" type="checkbox" value="${id}" />
        <span class="offset-person-chip">${escapeHtml(MEMBERS[id].name)}</span>
      </label>`,
  ).join("");
}

let debtManager;

// ---------------------------------------------------------------------------
// Quản lý tính nợ
// ---------------------------------------------------------------------------
class DebtManager {
  constructor() {
    this.debtsRef = database.ref("debts");
    this.transactionsRef = database.ref("transactions");
    this.selectedMember = "A";
    this.timeFilter = "all";
    this.debts = {};
    this.transactions = {};
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      console.error("Lỗi khởi tạo:", error);
      toast("Lỗi kết nối Firebase: " + error.message, "error");
    }
  }

  async loadData() {
    try {
      const [debtsSnapshot, transactionsSnapshot] = await Promise.all([
        this.debtsRef.once("value"),
        this.transactionsRef.once("value"),
      ]);

      this.debts = debtsSnapshot.val() || {};
      this.transactions = transactionsSnapshot.val() || {};

      this.updateMemberInfo();
      this.loadTransactionHistory();
      this.updateDataStats();
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      toast("Không tải được dữ liệu", "error");
    }
  }

  // Ghi nợ và giao dịch trong một lần cập nhật duy nhất.
  // debtChanges: { "A_B": số tiền mới, hoặc null để xóa }
  async commit(debtChanges, transaction) {
    const updates = {};
    Object.entries(debtChanges).forEach(([key, value]) => {
      updates[`debts/${key}`] = value > 0 ? value : null;
    });
    if (transaction) {
      updates[`transactions/${transaction.id}`] = transaction;
    }
    await database.ref().update(updates);
    await this.loadData();
  }

  newTransactionId(suffix = "") {
    return `${Date.now()}${suffix}`;
  }

  // ---- Hiển thị ----------------------------------------------------------
  updateMemberInfo() {
    document.getElementById("selectedMemberName").textContent =
      MEMBERS[this.selectedMember].name;

    const owedToThem = [];
    const theyOwe = [];

    Object.entries(this.debts).forEach(([key, amount]) => {
      if (!(amount > 0)) return;
      const [debtor, creditor] = key.split("_");
      if (!MEMBERS[debtor] || !MEMBERS[creditor]) return;

      if (creditor === this.selectedMember) {
        owedToThem.push({ person: MEMBERS[debtor].name, amount });
      } else if (debtor === this.selectedMember) {
        theyOwe.push({ person: MEMBERS[creditor].name, amount });
      }
    });

    this.displayDebtList("owedToThem", owedToThem);
    this.displayDebtList("theyOwe", theyOwe);
    this.updateAccountInfo();
    this.updateQRCode();
  }

  updateAccountInfo() {
    const member = MEMBERS[this.selectedMember];
    document.getElementById("accountName").textContent = member.name;
    document.getElementById("accountNumber").textContent =
      member.account || NO_ACCOUNT_TEXT;
    document.getElementById("bankName").textContent =
      member.bank || NO_ACCOUNT_TEXT;
    document.querySelector(".copy-btn").disabled = !member.account;
    document
      .querySelector(".qr-section")
      .classList.toggle("hidden", !hasBankAccount(member));
  }

  updateQRCode() {
    const member = MEMBERS[this.selectedMember];
    if (!hasBankAccount(member)) return;
    document.getElementById("qrCode").src = generateVietQR(
      member.bankCode,
      member.account,
      "",
      `Chuyen tien cho ${member.name}`,
    );
  }

  displayDebtList(elementId, debtList) {
    const element = document.getElementById(elementId);

    if (debtList.length === 0) {
      element.innerHTML = "<p>Không có khoản nợ nào</p>";
      return;
    }

    element.innerHTML = debtList
      .map(
        (debt) => `
          <div class="debt-item">
            <span>${escapeHtml(debt.person)}</span>
            <span class="debt-amount">${formatCurrency(debt.amount)}</span>
          </div>`,
      )
      .join("");
  }

  describeTransaction(t) {
    const payer = memberName(t.payer);
    const first = memberName((t.sharedWith || [])[0]);

    if (t.type === "loan") return `${payer} cho ${first} vay tiền`;
    if (t.type === "payment") return `${payer} trả nợ cho ${first}`;
    if (t.type === "system") return t.note || "Hệ thống xử lý";

    const sharedWith = (t.sharedWith || []).map(memberName).join(", ");
    return `${payer} trả tiền • Chia với: ${sharedWith}`;
  }

  loadTransactionHistory() {
    const transactionList = document.getElementById("transactionList");
    let transactions = Object.values(this.transactions);

    if (transactions.length === 0) {
      transactionList.innerHTML = "<p>Chưa có giao dịch nào</p>";
      return;
    }

    if (this.timeFilter !== "all") {
      const cutoff = Date.now() - parseInt(this.timeFilter, 10) * 86400000;
      transactions = transactions.filter((t) => t.timestamp > cutoff);
    }

    if (transactions.length === 0) {
      transactionList.innerHTML = "<p>Không có giao dịch trong khoảng này</p>";
      return;
    }

    transactionList.innerHTML = transactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(
        (t) => `
          <div class="transaction-item">
            <div class="transaction-header">
              <span class="transaction-title">${escapeHtml(t.item)}</span>
              <span class="transaction-amount">${formatCurrency(t.amount)}</span>
            </div>
            <div class="transaction-details">
              ${escapeHtml(this.describeTransaction(t))} • ${formatDate(t.timestamp)}
            </div>
          </div>`,
      )
      .join("");
  }

  updateDataStats() {
    const times = Object.values(this.transactions).map((t) => t.timestamp);
    const el = document.getElementById("dataStats");

    if (times.length === 0) {
      el.textContent = "Chưa có giao dịch nào";
      return;
    }

    const oldest = new Date(Math.min(...times)).toLocaleDateString("vi-VN");
    el.textContent = `${times.length} giao dịch • Cũ nhất: ${oldest}`;
  }

  // ---- Dữ liệu -----------------------------------------------------------
  async cleanupOldData() {
    try {
      const sixMonthsAgo = Date.now() - 6 * 30 * 86400000;
      const oldIds = Object.entries(this.transactions)
        .filter(([, t]) => t.timestamp < sixMonthsAgo)
        .map(([id]) => id);

      if (oldIds.length === 0) {
        toast("Không có dữ liệu cũ hơn 6 tháng để xóa!");
        return;
      }

      const ok = await confirmDialog(
        `Sẽ xóa ${oldIds.length} giao dịch cũ hơn 6 tháng. Tiếp tục?`,
        { okText: "Xóa", danger: true },
      );
      if (!ok) return;

      const updates = {};
      oldIds.forEach((id) => (updates[`transactions/${id}`] = null));
      await database.ref().update(updates);
      await this.loadData();
      toast(`Đã xóa ${oldIds.length} giao dịch cũ!`, "success");
    } catch (error) {
      console.error("Lỗi dọn dẹp:", error);
      toast("Có lỗi khi dọn dẹp dữ liệu!", "error");
    }
  }

  exportReport() {
    const transactions = Object.values(this.transactions).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    if (transactions.length === 0) {
      toast("Chưa có giao dịch nào để xuất!");
      return;
    }

    const typeLabel = {
      loan: "Cho vay",
      payment: "Trả nợ",
      system: "Hệ thống",
    };

    const rows = transactions.map((t) => [
      formatDate(t.timestamp),
      typeLabel[t.type] || "Chia tiền",
      t.item,
      t.amount,
      memberName(t.payer),
      (t.sharedWith || []).map(memberName).join(", "),
    ]);

    const csv = [
      ["Ngày", "Loại", "Nội dung", "Số tiền", "Người trả", "Người liên quan"],
      ...rows,
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    // BOM để Excel đọc đúng tiếng Việt
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao-cao-giao-dich.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Nghiệp vụ ---------------------------------------------------------
  // Chia đều cho người trả + những người được chia. Số dư (vài đồng lẻ) được
  // rải 1đ cho từng người được chia thay vì dồn hết cho người trả.
  async addExpense({ itemName, amount, payer, sharedWith, offsetMode, offsetMembers }) {
    try {
      const totalPeople = sharedWith.length + 1;
      const base = Math.floor(amount / totalPeople);
      const remainder = amount - base * totalPeople;
      const shareOf = (index) => base + (index < remainder ? 1 : 0);

      const shouldOffsetFor = (person) => {
        if (offsetMode === "all") return true;
        if (offsetMode === "custom") return offsetMembers.includes(person);
        return false;
      };

      const debtChanges = {};
      const offsetApplied = [];

      sharedWith.forEach((person, index) => {
        const debtKey = `${person}_${payer}`;
        const reverseKey = `${payer}_${person}`;
        let remaining = shareOf(index);

        if (shouldOffsetFor(person)) {
          const reverseDebt = this.debts[reverseKey] || 0;
          if (reverseDebt > 0) {
            const offset = Math.min(reverseDebt, remaining);
            debtChanges[reverseKey] = reverseDebt - offset;
            remaining -= offset;
            offsetApplied.push({ person, amount: offset });
          }
        }

        if (remaining > 0) {
          debtChanges[debtKey] = (this.debts[debtKey] || 0) + remaining;
        }
      });

      const id = this.newTransactionId();
      const timestamp = Date.now();

      // Giao dịch chính + giao dịch bù trừ được ghi cùng một lần
      const updates = {};
      Object.entries(debtChanges).forEach(([key, value]) => {
        updates[`debts/${key}`] = value > 0 ? value : null;
      });
      updates[`transactions/${id}`] = {
        id,
        item: itemName,
        amount,
        payer,
        sharedWith,
        perPerson: base,
        timestamp,
        offsetMode,
        offsetMembers,
      };

      if (offsetApplied.length > 0) {
        const offsetId = `${id}_offset`;
        const totalOffset = offsetApplied.reduce((sum, i) => sum + i.amount, 0);
        updates[`transactions/${offsetId}`] = {
          id: offsetId,
          item: "Tự động trừ vào nợ khi chia",
          amount: totalOffset,
          payer,
          sharedWith: offsetApplied.map((i) => i.person),
          perPerson: totalOffset,
          timestamp,
          type: "system",
          note: offsetApplied
            .map(
              (i) =>
                `${memberName(payer)} bù trừ với ${memberName(i.person)}: ${formatCurrency(i.amount)}`,
            )
            .join(" | "),
        };
      }

      await database.ref().update(updates);
      await this.loadData();
      toast("Đã chia tiền thành công!", "success");
      return true;
    } catch (error) {
      console.error("Lỗi thêm chi phí:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
      return false;
    }
  }

  async payDebt(debtor, creditor, amount) {
    try {
      const debtKey = `${debtor}_${creditor}`;
      const currentDebt = this.debts[debtKey] || 0;

      if (currentDebt < amount) {
        toast("Số tiền trả lớn hơn số nợ hiện tại!", "error");
        return false;
      }

      const id = this.newTransactionId();
      await this.commit(
        { [debtKey]: currentDebt - amount },
        {
          id,
          item: "Trả nợ",
          amount,
          payer: debtor,
          sharedWith: [creditor],
          perPerson: amount,
          timestamp: Date.now(),
          type: "payment",
        },
      );
      toast(
        `${memberName(debtor)} đã trả ${formatCurrency(amount)} cho ${memberName(creditor)}!`,
        "success",
      );
      return true;
    } catch (error) {
      console.error("Lỗi trả nợ:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
      return false;
    }
  }

  async addLoan(lender, borrower, amount) {
    try {
      const debtKey = `${borrower}_${lender}`;
      const id = this.newTransactionId();
      await this.commit(
        { [debtKey]: (this.debts[debtKey] || 0) + amount },
        {
          id,
          item: "Nợ tiền (Cho vay)",
          amount,
          payer: lender,
          sharedWith: [borrower],
          perPerson: amount,
          timestamp: Date.now(),
          type: "loan",
        },
      );
      toast(
        `${memberName(lender)} đã cho ${memberName(borrower)} vay ${formatCurrency(amount)}!`,
        "success",
      );
      return true;
    } catch (error) {
      console.error("Lỗi khi ghi nợ:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
      return false;
    }
  }

  async clearAllDebt(debtor, creditor) {
    try {
      const debtKey = `${debtor}_${creditor}`;
      const currentDebt = this.debts[debtKey] || 0;

      if (currentDebt === 0) {
        toast("Không có khoản nợ nào để xóa!");
        return;
      }

      const ok = await confirmDialog(
        `Xác nhận xóa toàn bộ nợ ${formatCurrency(currentDebt)} của ${memberName(debtor)} cho ${memberName(creditor)}?`,
        { okText: "Xóa nợ", danger: true },
      );
      if (!ok) return;

      const id = this.newTransactionId();
      await this.commit(
        { [debtKey]: 0 },
        {
          id,
          item: "Xóa toàn bộ nợ",
          amount: currentDebt,
          payer: debtor,
          sharedWith: [creditor],
          perPerson: currentDebt,
          timestamp: Date.now(),
          type: "payment",
        },
      );
      toast(
        `Đã xóa toàn bộ nợ ${formatCurrency(currentDebt)} của ${memberName(debtor)} cho ${memberName(creditor)}!`,
        "success",
      );
    } catch (error) {
      console.error("Lỗi xóa nợ:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
    }
  }

  // Tính phần cấn trừ giữa hai người, trả về { changes, offset } hoặc null
  netPair(member1, member2) {
    const key1 = `${member1}_${member2}`;
    const key2 = `${member2}_${member1}`;
    const debt1 = this.debts[key1] || 0;
    const debt2 = this.debts[key2] || 0;
    const offset = Math.min(debt1, debt2);
    if (offset === 0) return null;

    return {
      offset,
      changes: { [key1]: debt1 - offset, [key2]: debt2 - offset },
    };
  }

  async netPairDebt(member1, member2) {
    try {
      if (!member1 || !member2 || member1 === member2) {
        toast("Vui lòng chọn 2 người khác nhau để trừ nợ chéo!", "error");
        return;
      }

      const result = this.netPair(member1, member2);
      if (!result) {
        toast("Hai người này không có nợ chéo để trừ!");
        return;
      }

      const id = this.newTransactionId("_net_pair");
      await this.commit(result.changes, {
        id,
        item: "Trừ nợ chéo 2 người",
        amount: result.offset,
        payer: member1,
        sharedWith: [member2],
        perPerson: result.offset,
        timestamp: Date.now(),
        type: "system",
      });

      toast(
        `Đã trừ nợ chéo giữa ${memberName(member1)} và ${memberName(member2)}. Cấn trừ: ${formatCurrency(result.offset)}.`,
        "success",
      );
    } catch (error) {
      console.error("Lỗi trừ nợ chéo 2 người:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
    }
  }

  async netAllMutualDebts() {
    try {
      const changes = {};
      let totalOffset = 0;
      let pairCount = 0;

      for (let i = 0; i < MEMBER_IDS.length; i++) {
        for (let j = i + 1; j < MEMBER_IDS.length; j++) {
          const result = this.netPair(MEMBER_IDS[i], MEMBER_IDS[j]);
          if (!result) continue;
          Object.assign(changes, result.changes);
          totalOffset += result.offset;
          pairCount += 1;
        }
      }

      if (pairCount === 0) {
        toast("Hiện không có nợ chéo để trừ toàn bộ!");
        return;
      }

      const id = this.newTransactionId("_net_all");
      await this.commit(changes, {
        id,
        item: "Trừ toàn bộ nợ chéo",
        amount: totalOffset,
        payer: this.selectedMember,
        sharedWith: MEMBER_IDS,
        perPerson: totalOffset,
        timestamp: Date.now(),
        type: "system",
        note: `Cấn trừ ${pairCount} cặp nợ chéo`,
      });

      toast(
        `Đã trừ toàn bộ nợ chéo cho ${pairCount} cặp. Tổng cấn trừ: ${formatCurrency(totalOffset)}.`,
        "success",
      );
    } catch (error) {
      console.error("Lỗi trừ toàn bộ nợ chéo:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
    }
  }

  // ---- Sự kiện -----------------------------------------------------------
  setupEventListeners() {
    const expenseForm = document.getElementById("expenseForm");
    const expenseOffsetContainer = document.querySelector(".debt-offset-options");
    const expenseOffsetCustomContainer =
      document.getElementById("expenseOffsetCustom");
    const expenseSubmitBtn = document.getElementById("expenseSubmitBtn");
    const payerSelect = document.getElementById("payer");

    const getSelectedSharedMembers = () =>
      Array.from(
        document.querySelectorAll(".checkbox-group .share-checkbox:checked"),
      )
        .map((checkbox) => checkbox.value)
        .filter((person) => person !== payerSelect.value);

    const getSelectedOffsetMembers = () =>
      Array.from(
        document.querySelectorAll("#expenseOffsetCustom .offset-checkbox:checked"),
      )
        .map((checkbox) => checkbox.value)
        .filter((person) => person !== payerSelect.value);

    // Ẩn người trả khỏi danh sách "chia với" và "trừ nợ riêng"
    const syncPayerDependentOptions = () => {
      const payer = payerSelect.value;
      document
        .querySelectorAll(
          ".checkbox-group .share-checkbox, #expenseOffsetCustom .offset-checkbox",
        )
        .forEach((checkbox) => {
          const isPayer = checkbox.value === payer;
          if (isPayer) checkbox.checked = false;
          checkbox.disabled = isPayer;
          checkbox.closest("label")?.classList.toggle("hidden", isPayer);
        });
    };

    const resetExpenseOffsetSelection = () => {
      document
        .querySelectorAll('input[name="expenseOffsetMode"]')
        .forEach((radio) => (radio.checked = false));
      expenseOffsetCustomContainer
        .querySelectorAll(".offset-checkbox")
        .forEach((checkbox) => (checkbox.checked = false));
      expenseOffsetCustomContainer.classList.add("hidden");
    };

    const updateExpenseSubmitState = () => {
      const sharedWith = getSelectedSharedMembers();
      const selectedMode = document.querySelector(
        'input[name="expenseOffsetMode"]:checked',
      );

      const hasValidShared =
        sharedWith.length > 0 && sharedWith.length <= MAX_SHARE_MEMBERS;
      const hasValidOffset =
        !!selectedMode &&
        (selectedMode.value !== "custom" || getSelectedOffsetMembers().length > 0);

      expenseSubmitBtn.disabled = !(hasValidShared && hasValidOffset);
    };

    const updateExpenseOffsetFlow = () => {
      const count = getSelectedSharedMembers().length;
      const show = count > 0 && count <= MAX_SHARE_MEMBERS;

      expenseOffsetContainer.classList.toggle("hidden", !show);
      if (!show) resetExpenseOffsetSelection();
      updateExpenseSubmitState();
    };

    // Chọn thành viên ở sidebar
    document.querySelectorAll(".member-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        document
          .querySelectorAll(".member-item")
          .forEach((i) => i.classList.remove("active"));
        e.currentTarget.classList.add("active");
        this.selectedMember = e.currentTarget.dataset.member;
        this.updateMemberInfo();
      });
    });

    document.getElementById("timeFilter").addEventListener("change", (e) => {
      this.timeFilter = e.target.value;
      this.loadTransactionHistory();
    });

    document
      .getElementById("cleanupBtn")
      .addEventListener("click", () => this.cleanupOldData());
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportReport());

    payerSelect.addEventListener("change", () => {
      syncPayerDependentOptions();
      syncSelectAllButton();
      updateExpenseOffsetFlow();
    });

    const selectAllBtn = document.getElementById("selectAllShareBtn");
    const getShareCheckboxes = () =>
      Array.from(
        document.querySelectorAll(".checkbox-group .share-checkbox"),
      ).filter((checkbox) => !checkbox.disabled);

    const syncSelectAllButton = () => {
      const boxes = getShareCheckboxes();
      const allChecked = boxes.length > 0 && boxes.every((cb) => cb.checked);
      selectAllBtn.textContent = allChecked ? "✕ Bỏ chọn tất cả" : "✓ Chọn tất cả";
    };

    document
      .querySelectorAll(".checkbox-group .share-checkbox")
      .forEach((checkbox) =>
        checkbox.addEventListener("change", () => {
          syncSelectAllButton();
          updateExpenseOffsetFlow();
        }),
      );

    // Chọn tất cả (trừ người trả), sau đó bỏ tích dần những ai không chia
    selectAllBtn.addEventListener("click", () => {
      const boxes = getShareCheckboxes();
      const allChecked = boxes.every((cb) => cb.checked);
      boxes.forEach((cb) => (cb.checked = !allChecked));
      syncSelectAllButton();
      updateExpenseOffsetFlow();
    });

    ["amount", "debtAmount", "loanAmount"].forEach((inputId) => {
      const input = document.getElementById(inputId);
      input.addEventListener("input", () => {
        input.value = formatNumberInput(input.value);
      });
    });

    document
      .querySelectorAll('input[name="expenseOffsetMode"]')
      .forEach((radio) => {
        radio.addEventListener("change", (e) => {
          if (e.target.value === "custom") {
            expenseOffsetCustomContainer.classList.remove("hidden");
          } else {
            expenseOffsetCustomContainer.classList.add("hidden");
            expenseOffsetCustomContainer
              .querySelectorAll(".offset-checkbox")
              .forEach((checkbox) => (checkbox.checked = false));
          }
          updateExpenseSubmitState();
        });
      });

    document
      .querySelectorAll("#expenseOffsetCustom .offset-checkbox")
      .forEach((checkbox) =>
        checkbox.addEventListener("change", updateExpenseSubmitState),
      );

    // Form chia tiền
    expenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const itemName = document.getElementById("itemName").value.trim();
      const amount = parseNumberInput(document.getElementById("amount").value);
      const payer = payerSelect.value;
      const sharedWith = getSelectedSharedMembers();
      const selectedMode = document.querySelector(
        'input[name="expenseOffsetMode"]:checked',
      );
      const offsetMode = selectedMode?.value || "none";
      const offsetMembers = getSelectedOffsetMembers();

      if (!itemName) {
        toast("Vui lòng nhập tên món đồ!", "error");
        return;
      }
      if (sharedWith.length === 0) {
        toast("Vui lòng chọn ít nhất một người để chia tiền!", "error");
        return;
      }
      if (sharedWith.length > MAX_SHARE_MEMBERS) {
        toast(`Chỉ được chọn tối đa ${MAX_SHARE_MEMBERS} người để chia tiền!`, "error");
        return;
      }
      if (amount < MIN_AMOUNT) {
        toast("Số tiền phải từ 1.000 VNĐ trở lên!", "error");
        return;
      }
      if (!selectedMode) {
        toast("Vui lòng chọn cách trừ nợ khi chia tiền!", "error");
        return;
      }
      if (offsetMode === "custom" && offsetMembers.length === 0) {
        toast("Bạn đã chọn chia riêng, hãy chọn ít nhất một người để trừ nợ!", "error");
        return;
      }

      expenseSubmitBtn.disabled = true;
      const ok = await this.addExpense({
        itemName,
        amount,
        payer,
        sharedWith,
        offsetMode,
        offsetMembers,
      });

      if (ok) {
        expenseForm.reset();
        document
          .querySelectorAll(
            ".checkbox-group .share-checkbox, #expenseOffsetCustom .offset-checkbox",
          )
          .forEach((cb) => (cb.checked = false));
        resetExpenseOffsetSelection();
        syncPayerDependentOptions();
        syncSelectAllButton();
      }
      updateExpenseOffsetFlow();
    });

    syncPayerDependentOptions();
    updateExpenseOffsetFlow();

    // Trừ nợ thủ công
    const manualForm = document.getElementById("manualDebtForm");
    manualForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const debtor = document.getElementById("debtor").value;
      const creditor = document.getElementById("creditor").value;
      const amount = parseNumberInput(document.getElementById("debtAmount").value);

      if (debtor === creditor) {
        toast("Người nợ và người cho nợ không thể giống nhau!", "error");
        return;
      }
      if (amount < MIN_AMOUNT) {
        toast("Số tiền phải từ 1.000 VNĐ trở lên!", "error");
        return;
      }

      const ok = await confirmDialog(
        `Xác nhận ${memberName(debtor)} trả ${formatCurrency(amount)} cho ${memberName(creditor)}?`,
      );
      if (ok && (await this.payDebt(debtor, creditor, amount))) {
        manualForm.reset();
      }
    });

    // Cho vay
    const loanForm = document.getElementById("loanForm");
    loanForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const lender = document.getElementById("lender").value;
      const borrower = document.getElementById("borrower").value;
      const amount = parseNumberInput(document.getElementById("loanAmount").value);

      if (lender === borrower) {
        toast("Người cho vay và người vay không thể giống nhau!", "error");
        return;
      }
      if (amount < MIN_AMOUNT) {
        toast("Số tiền phải từ 1.000 VNĐ trở lên!", "error");
        return;
      }

      const ok = await confirmDialog(
        `Xác nhận ${memberName(lender)} cho ${memberName(borrower)} vay ${formatCurrency(amount)}?`,
      );
      if (ok && (await this.addLoan(lender, borrower, amount))) {
        loanForm.reset();
      }
    });

    // Các nút thao tác theo cặp người
    const getPair = (sameMessage) => {
      const debtor = document.getElementById("debtor").value;
      const creditor = document.getElementById("creditor").value;

      if (!debtor || !creditor) {
        toast("Vui lòng chọn người nợ và người cho nợ!", "error");
        return null;
      }
      if (debtor === creditor) {
        toast(sameMessage, "error");
        return null;
      }
      return { debtor, creditor };
    };

    document.getElementById("clearAllDebtBtn").addEventListener("click", () => {
      const pair = getPair("Người nợ và người cho nợ không thể giống nhau!");
      if (pair) this.clearAllDebt(pair.debtor, pair.creditor);
    });

    document.getElementById("netPairDebtBtn").addEventListener("click", async () => {
      const pair = getPair("Người nợ và người cho nợ phải khác nhau!");
      if (!pair) return;

      const ok = await confirmDialog(
        `Trừ nợ chéo giữa ${memberName(pair.debtor)} và ${memberName(pair.creditor)}?`,
      );
      if (ok) this.netPairDebt(pair.debtor, pair.creditor);
    });

    document.getElementById("netAllDebtsBtn").addEventListener("click", async () => {
      if (await confirmDialog("Trừ toàn bộ các khoản nợ chéo hiện có?")) {
        this.netAllMutualDebts();
      }
    });
  }
}

// Máy tính: luôn mở các khối phụ; điện thoại/máy tính bảng: thu gọn, bấm để mở
function syncCollapsibles() {
  const isDesktop = window.matchMedia("(min-width: 1181px)").matches;
  document.querySelectorAll(".collapsible").forEach((el) => {
    el.open = isDesktop;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderMemberControls();
  syncCollapsibles();
  window
    .matchMedia("(min-width: 1181px)")
    .addEventListener("change", syncCollapsibles);
  debtManager = new DebtManager();
});

// ---------------------------------------------------------------------------
// Máy tính (không dùng eval)
// ---------------------------------------------------------------------------
let shouldResetDisplay = false;

function appendCalc(value) {
  const display = document.getElementById("calcDisplay");

  if (shouldResetDisplay) {
    // Gõ toán tử sau khi có kết quả thì tính tiếp, gõ số thì bắt đầu lại
    if (!/[0-9.]/.test(value)) {
      shouldResetDisplay = false;
    } else {
      display.value = "";
      shouldResetDisplay = false;
    }
  }

  if (display.value === "0" && value !== "." && /[0-9]/.test(value)) {
    display.value = value;
  } else if (display.value === "Lỗi") {
    display.value = /[0-9]/.test(value) ? value : "0";
  } else {
    display.value += value;
  }
}

function clearCalc() {
  document.getElementById("calcDisplay").value = "0";
  shouldResetDisplay = false;
}

function deleteLast() {
  const display = document.getElementById("calcDisplay");
  display.value = display.value.length > 1 ? display.value.slice(0, -1) : "0";
  if (display.value === "Lỗ") display.value = "0";
}

// Bộ tính biểu thức: + - * / và dấu trừ đơn ngôi, ưu tiên nhân chia
function evaluateExpression(source) {
  const tokens = source.replace(/×/g, "*").match(/\d*\.?\d+|[-+*/]/g);
  if (!tokens || tokens.join("") !== source.replace(/×/g, "*")) {
    throw new Error("Biểu thức không hợp lệ");
  }

  let pos = 0;
  const peek = () => tokens[pos];

  const parseFactor = () => {
    if (peek() === "-") {
      pos++;
      return -parseFactor();
    }
    if (peek() === "+") {
      pos++;
      return parseFactor();
    }
    const num = parseFloat(tokens[pos++]);
    if (Number.isNaN(num)) throw new Error("Biểu thức không hợp lệ");
    return num;
  };

  const parseTerm = () => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[pos++];
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };

  const parseExpr = () => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++];
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  const result = parseExpr();
  if (pos !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Biểu thức không hợp lệ");
  }
  return result;
}

function calculateResult() {
  const display = document.getElementById("calcDisplay");
  try {
    const result = evaluateExpression(display.value);
    display.value = String(Math.round(result * 1e10) / 1e10);
  } catch (error) {
    display.value = "Lỗi";
  }
  shouldResetDisplay = true;
}

// ---------------------------------------------------------------------------
// Sao chép số tài khoản / tải QR
// ---------------------------------------------------------------------------
function copyAccountNumber() {
  const member = MEMBERS[debtManager.selectedMember];
  if (!member.account) {
    toast("Thành viên này chưa cập nhật số tài khoản!");
    return;
  }

  navigator.clipboard
    .writeText(member.account)
    .then(() => {
      const copyBtn = document.querySelector(".copy-btn");
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "✅";
      toast("Đã sao chép số tài khoản", "success");
      setTimeout(() => (copyBtn.textContent = originalText), 2000);
    })
    .catch(() => {
      toast("Không thể copy. Vui lòng copy thủ công: " + member.account, "error");
    });
}

function downloadQR() {
  const member = MEMBERS[debtManager.selectedMember];
  if (!hasBankAccount(member)) {
    toast("Thành viên này chưa cập nhật số tài khoản!");
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);

    const link = document.createElement("a");
    link.download = `QR-${member.name}.png`;
    link.href = canvas.toDataURL();
    link.click();
    toast(`Đã tải QR của ${member.name} về máy!`, "success");
  };
  img.onerror = () => toast("Không thể tải QR code. Vui lòng thử lại!", "error");
  img.src = document.getElementById("qrCode").src;
}
