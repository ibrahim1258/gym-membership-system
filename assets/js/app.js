const DB_NAME = "gym-membership-db";
    const DB_VERSION = 1;
    const ADMIN = { username: "admin", password: "gym123", name: "Admin" };

    const state = {
      currentUser: null,
      mode: "guest",
      db: null
    };

    const loginView = document.getElementById("login-view");
    const loginForm = document.getElementById("login-form");
    const loginStatus = document.getElementById("login-status");
    const adminDashboard = document.getElementById("admin-dashboard");
    const memberDashboard = document.getElementById("member-dashboard");
    const memberForm = document.getElementById("member-form");
    const memberStatus = document.getElementById("member-status");
    const membersCollection = document.getElementById("members-collection");
    const adminSuggestions = document.getElementById("admin-suggestions");
    const memberFormTitle = document.getElementById("member-form-title");
    const memberSubmit = document.getElementById("member-submit");
    const cancelEditButton = document.getElementById("cancel-edit");
    const adminLogoutButton = document.getElementById("admin-logout");
    const memberLogoutButton = document.getElementById("member-logout");
    const exportBackupButton = document.getElementById("export-backup");
    const importBackupInput = document.getElementById("import-backup");
    const suggestionForm = document.getElementById("suggestion-form");
    const suggestionStatus = document.getElementById("suggestion-status");
    const startInput = document.getElementById("member-start");

    startInput.value = new Date().toISOString().split("T")[0];

    function openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains("users")) {
            const usersStore = db.createObjectStore("users", { keyPath: "id" });
            usersStore.createIndex("username", "username", { unique: true });
          }

          if (!db.objectStoreNames.contains("suggestions")) {
            const suggestionsStore = db.createObjectStore("suggestions", { keyPath: "id" });
            suggestionsStore.createIndex("user_id", "user_id", { unique: false });
            suggestionsStore.createIndex("date", "date", { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    function tx(storeNames, mode = "readonly") {
      return state.db.transaction(storeNames, mode);
    }

    function requestToPromise(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function getAll(storeName) {
      const transaction = tx([storeName]);
      return requestToPromise(transaction.objectStore(storeName).getAll());
    }

    async function getById(storeName, id) {
      const transaction = tx([storeName]);
      return requestToPromise(transaction.objectStore(storeName).get(id));
    }

    function completeTransaction(transaction) {
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    }

    async function putRecord(storeName, value) {
      const transaction = tx([storeName], "readwrite");
      transaction.objectStore(storeName).put(value);
      return completeTransaction(transaction);
    }

    async function deleteRecord(storeName, id) {
      const transaction = tx([storeName], "readwrite");
      transaction.objectStore(storeName).delete(id);
      return completeTransaction(transaction);
    }

    async function deleteSuggestionsByUser(userId) {
      const suggestions = await getAll("suggestions");
      const transaction = tx(["suggestions"], "readwrite");
      const store = transaction.objectStore("suggestions");
      suggestions.filter((item) => item.user_id === userId).forEach((item) => store.delete(item.id));
      return completeTransaction(transaction);
    }

    async function clearStore(storeName) {
      const transaction = tx([storeName], "readwrite");
      transaction.objectStore(storeName).clear();
      return completeTransaction(transaction);
    }

    function createId() {
      return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    }

    function normalizeDate(value) {
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function addMonths(dateValue, months) {
      const date = normalizeDate(dateValue);
      const next = new Date(date);
      next.setMonth(next.getMonth() + Number(months));
      return next;
    }

    function formatDate(value) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(normalizeDate(value));
    }

    function getSubscription(user) {
      const startDate = normalizeDate(user.start_date);
      const endDate = normalizeDate(user.end_date || addMonths(startDate, user.duration_months));
      const today = normalizeDate(new Date());
      const diff = Math.ceil((endDate - today) / 86400000);
      return {
        startDate,
        endDate,
        remainingDays: Math.max(0, diff),
        active: diff > 0
      };
    }

    function setStatus(node, message, type) {
      node.textContent = message;
      node.className = "status " + type;
    }

    function clearStatus(node) {
      node.textContent = "";
      node.className = "status";
    }

    function switchView(mode) {
      state.mode = mode;
      loginView.classList.toggle("hidden", mode !== "guest");
      adminDashboard.classList.toggle("active", mode === "admin");
      memberDashboard.classList.toggle("active", mode === "member");
    }

    function resetMemberForm() {
      memberForm.reset();
      document.getElementById("member-id").value = "";
      startInput.value = new Date().toISOString().split("T")[0];
      document.getElementById("member-duration").value = "1";
      memberFormTitle.textContent = "Add New Member";
      memberSubmit.textContent = "Save Member";
      cancelEditButton.classList.add("hidden");
    }

    function logout() {
      state.currentUser = null;
      switchView("guest");
      loginForm.reset();
      suggestionForm.reset();
      clearStatus(loginStatus);
      clearStatus(memberStatus);
      clearStatus(suggestionStatus);
      resetMemberForm();
    }

    async function findUserByUsername(username) {
      const users = await getAll("users");
      return users.find((user) => user.username.toLowerCase() === username.toLowerCase()) || null;
    }

    async function renderAdminOverview() {
      const users = await getAll("users");
      const suggestions = await getAll("suggestions");
      const activeCount = users.filter((user) => getSubscription(user).active).length;
      document.getElementById("total-members").textContent = String(users.length);
      document.getElementById("active-members").textContent = String(activeCount);
      document.getElementById("expired-members").textContent = String(users.length - activeCount);
      document.getElementById("total-suggestions").textContent = String(suggestions.length);
    }

    async function renderMembers() {
      const users = await getAll("users");
      if (!users.length) {
        membersCollection.innerHTML = '<div class="empty">No members yet. Add your first member from the form above.</div>';
        return;
      }

      membersCollection.innerHTML = users.map((user) => {
        const sub = getSubscription(user);
        const badgeClass = sub.active ? "badge ok" : "badge expired";
        const badgeText = sub.active ? `${sub.remainingDays} days left` : "Expired";
        return `
          <article class="item">
            <div class="item-head">
              <div>
                <h3>${user.name}</h3>
                <p>@${user.username}</p>
              </div>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <p>Start Date: ${formatDate(sub.startDate)}</p>
            <p>End Date: ${formatDate(sub.endDate)}</p>
            <p>Password: ${user.password}</p>
            <div class="actions">
              <button class="secondary" type="button" onclick="editMember('${user.id}')">Edit</button>
              <button class="danger" type="button" onclick="deleteMember('${user.id}')">Delete</button>
            </div>
          </article>
        `;
      }).join("");
    }

    async function renderSuggestions() {
      const [users, suggestions] = await Promise.all([getAll("users"), getAll("suggestions")]);
      if (!suggestions.length) {
        adminSuggestions.innerHTML = '<div class="empty">No suggestions yet.</div>';
        return;
      }

      const usersById = Object.fromEntries(users.map((user) => [user.id, user]));
      const ordered = [...suggestions].sort((a, b) => new Date(b.date) - new Date(a.date));
      adminSuggestions.innerHTML = ordered.map((item) => {
        const user = usersById[item.user_id];
        return `
          <article class="suggestion-item">
            <div class="item-head">
              <strong>${user ? user.name : "Unknown User"}</strong>
              <span class="badge">${new Date(item.date).toLocaleString("en-GB")}</span>
            </div>
            <p>@${user ? user.username : "unknown"}</p>
            <p>${item.suggestion}</p>
          </article>
        `;
      }).join("");
    }

    async function renderMemberDashboard() {
      if (!state.currentUser) {
        return;
      }

      const current = await getById("users", state.currentUser.id);
      if (!current) {
        logout();
        return;
      }

      state.currentUser = current;
      const sub = getSubscription(current);
      document.getElementById("member-welcome-title").textContent = `Welcome, ${current.name}`;
      document.getElementById("member-start-date").textContent = formatDate(sub.startDate);
      document.getElementById("member-end-date").textContent = formatDate(sub.endDate);
      document.getElementById("member-remaining-days").textContent = `${sub.remainingDays} days`;
      const badge = document.getElementById("member-status-badge");
      badge.textContent = sub.active ? "Active" : "Expired";
      badge.className = sub.active ? "badge ok" : "badge expired";
    }

    async function renderAll() {
      await Promise.all([renderAdminOverview(), renderMembers(), renderSuggestions()]);
      if (state.mode === "member") {
        await renderMemberDashboard();
      }
    }

    window.editMember = async function editMember(id) {
      const user = await getById("users", id);
      if (!user) {
        return;
      }

      document.getElementById("member-id").value = user.id;
      document.getElementById("member-name").value = user.name;
      document.getElementById("member-username").value = user.username;
      document.getElementById("member-password").value = user.password;
      document.getElementById("member-start").value = user.start_date;
      document.getElementById("member-duration").value = String(user.duration_months);
      memberFormTitle.textContent = "Edit Member";
      memberSubmit.textContent = "Update Member";
      cancelEditButton.classList.remove("hidden");
      clearStatus(memberStatus);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.deleteMember = async function deleteMember(id) {
      const user = await getById("users", id);
      if (!user) {
        return;
      }

      if (!window.confirm(`Delete ${user.name}?`)) {
        return;
      }

      await deleteRecord("users", id);
      await deleteSuggestionsByUser(id);
      setStatus(memberStatus, "Member deleted successfully.", "success");
      await renderAll();
      if (state.currentUser && state.currentUser.id === id) {
        logout();
      }
    };

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus(loginStatus);

      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value.trim();

      if (username === ADMIN.username && password === ADMIN.password) {
        state.currentUser = ADMIN;
        switchView("admin");
        await renderAll();
        return;
      }

      const member = await findUserByUsername(username);
      if (!member || member.password !== password) {
        setStatus(loginStatus, "Invalid username or password.", "error");
        return;
      }

      state.currentUser = member;
      switchView("member");
      await renderMemberDashboard();
      suggestionForm.reset();
    });

    memberForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus(memberStatus);

      const id = document.getElementById("member-id").value;
      const username = document.getElementById("member-username").value.trim();
      const existing = await findUserByUsername(username);
      if (existing && existing.id !== id) {
        setStatus(memberStatus, "This username is already used by another member.", "error");
        return;
      }

      const startDate = document.getElementById("member-start").value;
      const durationMonths = Number(document.getElementById("member-duration").value);
      const member = {
        id: id || createId(),
        name: document.getElementById("member-name").value.trim(),
        username,
        password: document.getElementById("member-password").value.trim(),
        start_date: startDate,
        duration_months: durationMonths,
        end_date: addMonths(startDate, durationMonths).toISOString()
      };

      await putRecord("users", member);
      setStatus(memberStatus, id ? "Member updated successfully." : "Member added successfully.", "success");
      resetMemberForm();
      await renderAll();
    });

    suggestionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus(suggestionStatus);

      if (!state.currentUser || state.mode !== "member") {
        setStatus(suggestionStatus, "Please log in as a member first.", "error");
        return;
      }

      const text = document.getElementById("suggestion-text").value.trim();
      if (!text) {
        setStatus(suggestionStatus, "Please write a suggestion before sending.", "error");
        return;
      }

      await putRecord("suggestions", {
        id: createId(),
        user_id: state.currentUser.id,
        suggestion: text,
        date: new Date().toISOString()
      });

      suggestionForm.reset();
      setStatus(suggestionStatus, "Suggestion sent successfully.", "success");
      await renderAll();
    });

    cancelEditButton.addEventListener("click", () => {
      resetMemberForm();
      clearStatus(memberStatus);
    });

    exportBackupButton.addEventListener("click", async () => {
      const [users, suggestions] = await Promise.all([getAll("users"), getAll("suggestions")]);
      const backup = {
        exported_at: new Date().toISOString(),
        users,
        suggestions
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "gym-membership-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setStatus(memberStatus, "Backup exported successfully.", "success");
    });

    importBackupInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const users = Array.isArray(backup.users) ? backup.users : [];
        const suggestions = Array.isArray(backup.suggestions) ? backup.suggestions : [];

        await clearStore("users");
        await clearStore("suggestions");

        for (const user of users) {
          await putRecord("users", user);
        }

        for (const suggestion of suggestions) {
          await putRecord("suggestions", suggestion);
        }

        resetMemberForm();
        await renderAll();
        setStatus(memberStatus, "Backup imported successfully.", "success");
      } catch (error) {
        setStatus(memberStatus, "Backup file is invalid.", "error");
      }

      importBackupInput.value = "";
    });

    adminLogoutButton.addEventListener("click", logout);
    memberLogoutButton.addEventListener("click", logout);

    async function init() {
      try {
        state.db = await openDatabase();
        await renderAll();
      } catch (error) {
        setStatus(loginStatus, "Database initialization failed in this browser.", "error");
      }
    }

    init();
