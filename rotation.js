// Trang xoay vòng (đổi nước / mua kem đánh răng / mua nước rửa bát).
// Cần common.js được nạp trước.
//
// new RotationManager({
//   path: "waterRotation",            // nhánh trong Firebase
//   doneVerb: "đổi nước",             // "... đã đổi nước"
//   confirmText: "Xác nhận đã đổi nước?",
//   emptyHistory: "Chưa có lịch sử đổi nước",
// })
class RotationManager {
  constructor(options) {
    this.options = options;
    this.dbRef = database.ref(options.path);
    this.busy = false;
    this.init();
  }

  async init() {
    try {
      const snapshot = await this.dbRef.once("value");
      if (!snapshot.exists()) {
        await this.dbRef.set({
          people: [...MEMBER_IDS],
          currentIndex: 0,
          history: [],
        });
      } else {
        await this.syncMembers();
      }

      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      console.error("Lỗi khởi tạo:", error);
      toast("Lỗi kết nối Firebase: " + error.message, "error");
    }
  }

  // Thêm thành viên mới vào vòng xoay hiện có, giữ nguyên lượt đang chạy
  async syncMembers() {
    const snapshot = await this.dbRef.child("people").once("value");
    const people = snapshot.val() || [];
    const missing = MEMBER_IDS.filter((id) => !people.includes(id));
    if (missing.length > 0) {
      await this.dbRef.child("people").set([...people, ...missing]);
    }
  }

  async loadData() {
    try {
      const snapshot = await this.dbRef.once("value");
      const data = snapshot.val();
      if (data) {
        this.updateDisplay(data);
        this.loadHistory(data.history || []);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      toast("Không tải được dữ liệu", "error");
    }
  }

  updateDisplay({ people, currentIndex }) {
    const previousIndex = (currentIndex - 1 + people.length) % people.length;
    const nextIndex = (currentIndex + 1) % people.length;

    document.getElementById("previousPerson").textContent = memberName(
      people[previousIndex],
    );
    document.getElementById("currentPerson").textContent = memberName(
      people[currentIndex],
    );
    document.getElementById("nextPerson").textContent = memberName(
      people[nextIndex],
    );
  }

  loadHistory(history) {
    const historyList = document.getElementById("historyList");

    if (!history || history.length === 0) {
      historyList.innerHTML = `<p>${escapeHtml(this.options.emptyHistory)}</p>`;
      return;
    }

    historyList.innerHTML = [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(
        (item) => `
          <div class="history-item">
            <span><strong>${escapeHtml(memberName(item.by))}</strong> đã ${escapeHtml(this.options.doneVerb)}</span>
            <span>${formatDate(item.timestamp)}</span>
          </div>`,
      )
      .join("");
  }

  async completeRotation() {
    if (this.busy) return;
    this.busy = true;
    const btn = document.getElementById("completeBtn");
    btn.disabled = true;

    try {
      const snapshot = await this.dbRef.once("value");
      const data = snapshot.val();
      if (!data) return;

      const { people, currentIndex, history = [] } = data;
      const currentPerson = people[currentIndex];

      await this.dbRef.update({
        currentIndex: (currentIndex + 1) % people.length,
        history: [{ by: currentPerson, timestamp: Date.now() }, ...history],
      });

      await this.loadData();
      toast(
        `${memberName(currentPerson)} đã hoàn thành việc ${this.options.doneVerb}!`,
        "success",
      );
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      toast("Có lỗi xảy ra: " + error.message, "error");
    } finally {
      this.busy = false;
      btn.disabled = false;
    }
  }

  setupEventListeners() {
    document.getElementById("completeBtn").addEventListener("click", async () => {
      if (await confirmDialog(this.options.confirmText)) {
        this.completeRotation();
      }
    });
  }
}
