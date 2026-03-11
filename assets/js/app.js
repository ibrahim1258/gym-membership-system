const SUPABASE_URL = "https://huauixixvnciuiacayqo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1YXVpeGl4dm5jaXVpYWNheXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUyODksImV4cCI6MjA4ODYyMTI4OX0.Hzii8M3UEi1PSakEOjOFanJY9aYH8Plmt0J6TNJWxmM";
const ADMIN = { username: "admin", password: "gym123", name: "Admin" };

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  currentUser: null,
  mode: "guest"
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
  return new Intl.DateTimeFormat("ar-EG", {
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

function getFriendlyErrorMessage(error, fallbackMessage) {
  const message = error && error.message ? String(error.message) : "";

  if (message.includes("members_email_key")) {
    return "هذا البريد الإلكتروني مسجل بالفعل لعضو آخر.";
  }

  if (message.includes("members_username_key")) {
    return "اسم المستخدم مسجل بالفعل لعضو آخر.";
  }

  if (message.includes("Failed to fetch")) {
    return "تعذر الاتصال بقاعدة البيانات. تأكد من الإنترنت وإعدادات Supabase.";
  }

  return fallbackMessage;
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
  memberFormTitle.textContent = "إضافة عضو جديد";
  memberSubmit.textContent = "حفظ العضو";
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

function mapMemberRow(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    username: row.username,
    password: row.password,
    start_date: row.start_date,
    duration_months: row.duration_months,
    end_date: row.end_date,
    created_at: row.created_at
  };
}

function mapSuggestionRow(row) {
  return {
    id: row.id,
    user_id: row.member_id,
    suggestion: row.suggestion,
    date: row.created_at
  };
}

async function getAllUsers() {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapMemberRow);
}

async function getAllSuggestions() {
  const { data, error } = await supabaseClient
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapSuggestionRow);
}

async function getUserById(id) {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapMemberRow(data) : null;
}

async function findUserByUsername(username) {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapMemberRow(data) : null;
}

async function saveMember(member) {
  const payload = {
    id: member.id,
    full_name: member.name,
    email: member.email,
    username: member.username,
    password: member.password,
    start_date: member.start_date,
    duration_months: member.duration_months,
    end_date: member.end_date
  };

  const { error } = await supabaseClient.from("members").upsert(payload);
  if (error) {
    throw error;
  }
}

async function deleteMemberRecord(id) {
  const { error } = await supabaseClient.from("members").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

async function saveSuggestion(suggestion) {
  const payload = {
    id: suggestion.id,
    member_id: suggestion.user_id,
    suggestion: suggestion.suggestion,
    created_at: suggestion.date
  };

  const { error } = await supabaseClient.from("suggestions").insert(payload);
  if (error) {
    throw error;
  }
}

async function clearTable(tableName) {
  const { error } = await supabaseClient.from(tableName).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    throw error;
  }
}

async function renderAdminOverview() {
  const [users, suggestions] = await Promise.all([getAllUsers(), getAllSuggestions()]);
  const activeCount = users.filter((user) => getSubscription(user).active).length;
  document.getElementById("total-members").textContent = String(users.length);
  document.getElementById("active-members").textContent = String(activeCount);
  document.getElementById("expired-members").textContent = String(users.length - activeCount);
  document.getElementById("total-suggestions").textContent = String(suggestions.length);
}

async function renderMembers() {
  const users = await getAllUsers();
  if (!users.length) {
    membersCollection.innerHTML = '<div class="empty">لا يوجد أعضاء حالياً. قم بإضافة عضو من نموذج إضافة الأعضاء.</div>';
    return;
  }

  membersCollection.innerHTML = users.map((user) => {
    const sub = getSubscription(user);
    const badgeClass = sub.active ? "badge ok" : "badge expired";
    const badgeText = sub.active ? `${sub.remainingDays} يوم متبقي` : "منتهي";
    return `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${user.name}</h3>
            <p>@${user.username}</p>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
        <p>البريد الإلكتروني: ${user.email}</p>
        <p>بداية الاشتراك: ${formatDate(sub.startDate)}</p>
        <p>نهاية الاشتراك: ${formatDate(sub.endDate)}</p>
        <p>كلمة المرور: ${user.password}</p>
        <div class="actions">
          <button class="secondary" type="button" onclick="editMember('${user.id}')">تعديل</button>
          <button class="danger" type="button" onclick="deleteMember('${user.id}')">حذف</button>
        </div>
      </article>
    `;
  }).join("");
}

async function renderSuggestions() {
  const [users, suggestions] = await Promise.all([getAllUsers(), getAllSuggestions()]);
  if (!suggestions.length) {
    adminSuggestions.innerHTML = '<div class="empty">لا توجد اقتراحات حتى الآن.</div>';
    return;
  }

  const usersById = Object.fromEntries(users.map((user) => [user.id, user]));
  adminSuggestions.innerHTML = suggestions.map((item) => {
    const user = usersById[item.user_id];
    return `
      <article class="suggestion-item">
        <div class="item-head">
          <strong>${user ? user.name : "عضو غير معروف"}</strong>
          <span class="badge">${new Date(item.date).toLocaleString("ar-EG")}</span>
        </div>
        <p>@${user ? user.username : "مستخدم-غير-معروف"}</p>
        <p>${item.suggestion}</p>
      </article>
    `;
  }).join("");
}

async function renderMemberDashboard() {
  if (!state.currentUser) {
    return;
  }

  const current = await getUserById(state.currentUser.id);
  if (!current) {
    logout();
    return;
  }

  state.currentUser = current;
  const sub = getSubscription(current);
  document.getElementById("member-welcome-title").textContent = `مرحباً ${current.name}`;
  document.getElementById("member-start-date").textContent = formatDate(sub.startDate);
  document.getElementById("member-end-date").textContent = formatDate(sub.endDate);
  document.getElementById("member-remaining-days").textContent = `${sub.remainingDays} يوم`;
  const badge = document.getElementById("member-status-badge");
  badge.textContent = sub.active ? "نشط" : "منتهي";
  badge.className = sub.active ? "badge ok" : "badge expired";
}

async function renderAll() {
  await Promise.all([renderAdminOverview(), renderMembers(), renderSuggestions()]);
  if (state.mode === "member") {
    await renderMemberDashboard();
  }
}

window.editMember = async function editMember(id) {
  try {
    const user = await getUserById(id);
    if (!user) {
      return;
    }

    document.getElementById("member-id").value = user.id;
    document.getElementById("member-name").value = user.name;
    document.getElementById("member-email").value = user.email;
    document.getElementById("member-username").value = user.username;
    document.getElementById("member-password").value = user.password;
    document.getElementById("member-start").value = user.start_date;
    document.getElementById("member-duration").value = String(user.duration_months);
    memberFormTitle.textContent = "تعديل العضو";
    memberSubmit.textContent = "حفظ التعديل";
    cancelEditButton.classList.remove("hidden");
    clearStatus(memberStatus);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setStatus(memberStatus, error.message || "حدث خطأ أثناء تحميل بيانات العضو.", "error");
  }
};

window.deleteMember = async function deleteMember(id) {
  try {
    const user = await getUserById(id);
    if (!user) {
      return;
    }

    if (!window.confirm(`هل تريد حذف العضو ${user.name}?`)) {
      return;
    }

    await deleteMemberRecord(id);
    setStatus(memberStatus, "تم حذف العضو بنجاح.", "success");
    await renderAll();
    if (state.currentUser && state.currentUser.id === id) {
      logout();
    }
  } catch (error) {
    setStatus(memberStatus, error.message || "حدث خطأ أثناء حذف العضو.", "error");
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(loginStatus);

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    if (username === ADMIN.username && password === ADMIN.password) {
      state.currentUser = ADMIN;
      switchView("admin");
      await renderAll();
      return;
    }

    const member = await findUserByUsername(username);
    if (!member || member.password !== password) {
      setStatus(loginStatus, "اسم المستخدم أو كلمة المرور غير صحيحة.", "error");
      return;
    }

    state.currentUser = member;
    switchView("member");
    await renderMemberDashboard();
    suggestionForm.reset();
  } catch (error) {
    setStatus(loginStatus, error.message || "حدث خطأ أثناء تسجيل الدخول.", "error");
  }
});

memberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(memberStatus);

  const id = document.getElementById("member-id").value;
  const username = document.getElementById("member-username").value.trim();
  const email = document.getElementById("member-email").value.trim().toLowerCase();

  try {
    const existing = await findUserByUsername(username);
    if (existing && existing.id !== id) {
      setStatus(memberStatus, "اسم المستخدم مستخدم بالفعل لعضو آخر.", "error");
      return;
    }

    const startDate = document.getElementById("member-start").value;
    const durationMonths = Number(document.getElementById("member-duration").value);
    const member = {
      id: id || createId(),
      name: document.getElementById("member-name").value.trim(),
      email,
      username,
      password: document.getElementById("member-password").value.trim(),
      start_date: startDate,
      duration_months: durationMonths,
      end_date: addMonths(startDate, durationMonths).toISOString().split("T")[0]
    };

    await saveMember(member);
    setStatus(memberStatus, id ? "تم تحديث العضو بنجاح." : "تم إضافة العضو بنجاح.", "success");
    resetMemberForm();
    await renderAll();
  } catch (error) {
    setStatus(memberStatus, error.message || "حدث خطأ أثناء حفظ العضو.", "error");
  }
});

suggestionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(suggestionStatus);

  if (!state.currentUser || state.mode !== "member") {
    setStatus(suggestionStatus, "يجب تسجيل الدخول كعضو لإرسال اقتراح.", "error");
    return;
  }

  const text = document.getElementById("suggestion-text").value.trim();
  if (!text) {
    setStatus(suggestionStatus, "يرجى كتابة الاقتراح قبل الإرسال.", "error");
    return;
  }

  try {
    await saveSuggestion({
      id: createId(),
      user_id: state.currentUser.id,
      suggestion: text,
      date: new Date().toISOString()
    });

    suggestionForm.reset();
    setStatus(suggestionStatus, "تم إرسال الاقتراح بنجاح.", "success");
    await renderAll();
  } catch (error) {
    setStatus(suggestionStatus, error.message || "حدث خطأ أثناء إرسال الاقتراح.", "error");
  }
});

cancelEditButton.addEventListener("click", () => {
  resetMemberForm();
  clearStatus(memberStatus);
});

exportBackupButton.addEventListener("click", async () => {
  try {
    const [users, suggestions] = await Promise.all([getAllUsers(), getAllSuggestions()]);
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
    setStatus(memberStatus, "تم تصدير النسخة الاحتياطية بنجاح.", "success");
  } catch (error) {
    setStatus(memberStatus, error.message || "حدث خطأ أثناء تصدير النسخة الاحتياطية.", "error");
  }
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

    await clearTable("suggestions");
    await clearTable("members");

    for (const user of users) {
      await saveMember({
        id: user.id || createId(),
        name: user.name || user.full_name,
        email: user.email,
        username: user.username,
        password: user.password,
        start_date: user.start_date,
        duration_months: Number(user.duration_months),
        end_date: (user.end_date || addMonths(user.start_date, user.duration_months).toISOString()).split("T")[0]
      });
    }

    for (const suggestion of suggestions) {
      await saveSuggestion({
        id: suggestion.id || createId(),
        user_id: suggestion.user_id || suggestion.member_id,
        suggestion: suggestion.suggestion,
        date: suggestion.date || suggestion.created_at || new Date().toISOString()
      });
    }

    resetMemberForm();
    await renderAll();
    setStatus(memberStatus, "تم استيراد النسخة الاحتياطية بنجاح.", "success");
  } catch (error) {
    setStatus(memberStatus, error.message || "تعذر استيراد النسخة الاحتياطية. تأكد من صحة الملف.", "error");
  }

  importBackupInput.value = "";
});

adminLogoutButton.addEventListener("click", logout);
memberLogoutButton.addEventListener("click", logout);

async function init() {
  try {
    await renderAll();
  } catch (error) {
    setStatus(loginStatus, error.message || "تعذر تحميل بيانات النظام.", "error");
  }
}

init();





