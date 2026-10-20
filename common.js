// Dùng chung cho mọi trang: Firebase, danh sách thành viên, tiện ích và thông báo.

const firebaseConfig = {
  apiKey: "AIzaSyBb9dnBAgu7YBSnaRbty5CxPzM3Dvj-gi0",
  authDomain: "webtinhno.firebaseapp.com",
  databaseURL:
    "https://webtinhno-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webtinhno",
  storageBucket: "webtinhno.firebasestorage.app",
  messagingSenderId: "816939347254",
  appId: "1:816939347254:web:b684dcbbcb2bbaf4c95797",
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Danh sách thành viên. Thuật (E) và An (F) chưa có số tài khoản:
// điền account / bank / bankCode (mã VietQR) vào khi có, QR sẽ tự hiện.
const MEMBERS = {
  A: {
    name: "Dũng",
    account: "0368306901",
    bank: "MBBank",
    bankCode: "970422",
  },
  B: {
    name: "Quang",
    account: "1047435395",
    bank: "Vietcombank",
    bankCode: "970436",
  },
  C: {
    name: "Minh",
    account: "1027754014",
    bank: "Vietcombank",
    bankCode: "970436",
  },
  D: {
    name: "Cường",
    account: "1048146800",
    bank: "Vietcombank",
    bankCode: "970436",
  },
  E: { name: "Thuật", account: "", bank: "", bankCode: "" },
  F: { name: "An", account: "", bank: "", bankCode: "" },
};

const MEMBER_IDS = Object.keys(MEMBERS);

function memberName(id) {
  return MEMBERS[id] ? MEMBERS[id].name : "?";
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("vi-VN");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

// Chống chèn HTML khi đưa dữ liệu người dùng nhập vào innerHTML
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

// ---------------------------------------------------------------------------
// Thông báo (thay cho alert) và hộp thoại xác nhận (thay cho confirm)
// ---------------------------------------------------------------------------
function toast(message, type = "info") {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }

  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = message;
  stack.appendChild(item);

  const remove = () => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 250);
  };
  item.addEventListener("click", remove);
  setTimeout(remove, type === "error" ? 6000 : 3800);
}

function confirmDialog(message, { okText = "Xác nhận", danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <p class="modal-message"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-act="cancel">Hủy</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok"></button>
        </div>
      </div>`;
    overlay.querySelector(".modal-message").textContent = message;
    overlay.querySelector('[data-act="ok"]').textContent = okText;

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act) close(act === "ok");
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="ok"]').focus();
  });
}
