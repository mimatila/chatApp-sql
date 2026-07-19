let loading = false;
let refreshInterval = null;
let editingIndex = null;
let currentButtonsCache = [];

console.log("APP.JS VERSION 123");
console.log("APP START");

function sendQuick(text) {
  
  const boardName = localStorage.getItem("boardName");
  const boardUsername = localStorage.getItem("boardUsername");
  /*const boardUsername = localStorage.getItem("boardUsername") || boardName;*/

  let type="normal";

  if (document.getElementById("importantMode").checked) {
    type = "important";
  }

  if (document.getElementById("infoMode").checked) { 
    type="info";
  }

  fetch("http://localhost:3000/boardMessage", {
    method: "POST",
    headers: {
  "Content-Type": "application/json",
  "Authorization": localStorage.getItem("token")
},
    body: JSON.stringify({
    boardName,
    boardMessage: text,
    type
})
  })
  .then(res => res.json())
  .then(data => {
  if (!data.success) return alert(data.message);

  const input = document.getElementById("boardNewMsg");
  if (input) input.value = "";   // 👈 TÄRKEÄ

  loadMessage(true);

  document.getElementById("importantMode").checked = false;
  document.getElementById("infoMode").checked = false;
  type="normal";
});
}

function renderQuickSelect(buttons) {
  const select = document.getElementById("quickSelect");

  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.innerText = "Quick Messages...";
  select.appendChild(empty);

  buttons.forEach((text, index) => {
  const opt = document.createElement("option");
  opt.value = String(index);

  opt.innerText =
    text.length > 64
      ? text.substring(0, 64) + "..."
      : text;

  select.appendChild(opt);
});

  select.selectedIndex = 0;
}

document.addEventListener("DOMContentLoaded", () => {

  const select = document.getElementById("quickSelect");
  const el = document.getElementById("boardCount");

  loadBoardCount();

  if (select) {
  select.addEventListener("change", (e) => {

  const index = Number(e.target.value);
  const text = currentButtonsCache[index];

  if (!text) return;

  const editMode = document.getElementById("editMode").checked;

  if (editMode) {
    editingIndex = index;
    document.getElementById("boardNewMsg").value = text;
  } else {
    sendQuick(text);
  }
  });
  }

  initApp();
});

// =====================
// APP INIT
// =====================

function initApp() {

  console.log("INITAPP CALLED");
  bindUI();  
  autoLoginFill();
  if (document.getElementById("boardMessagesDiv")) {
    initBoard();
  }
}


// =====================
// UI EVENTS
// =====================

function bindUI() {

  const msgInput = document.getElementById("boardNewMsg");
  
  if (msgInput) {
  msgInput.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
      e.preventDefault();

      const editMode = document.getElementById("editMode")?.checked;

      if (editMode) {
        saveQuickMessage();
      } else {
        updateMessage();
      }

    }
  });
}

  document.addEventListener("change", (e) => {
  if (e.target?.id === "todayMode") {
    loadMessage(true);
  }
});
}


// =====================
// SAFE HELPERS
// =====================

function getBoardName() {
  return localStorage.getItem("boardName");
}


// =====================
// AUTO LOGIN FILL
// =====================

function autoLoginFill() {

  if (!document.getElementById("boardName")) {
    return;
}

  const boardName = localStorage.getItem("boardName");
  const boardUsername = localStorage.getItem("boardUsername");
  const token = localStorage.getItem("token");

  // täytä kentät
  const boardNameInput = document.getElementById("boardName");
  const boardUsernameInput = document.getElementById("boardUsername");

  boardNameInput && (boardNameInput.value = boardName || "");
  boardUsernameInput && (boardUsernameInput.value = boardUsername || "");

  // Home-painikkeella tullessa ohita autologin kerran
if (sessionStorage.getItem("skipAutoLogin")) {
  sessionStorage.removeItem("skipAutoLogin");
  return;
}

  // ei tokenia -> ei autologinia
  if (!boardName || !token) {
    return;
  }

  fetch("http://localhost:3000/authCheck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({
      boardName
    })
  })
  .then(r => r.json())
  .then(data => {

    if (!data.success) {
      localStorage.removeItem("token");
      return;
    }

    window.location.href = "board.html";
  });

}


// =====================
// BOARD INIT
// =====================


function initBoard() {

  const role = localStorage.getItem("role");

  const ownerButtons = [
    "requestsBtn",
    "settingsBtn",
    "deleteBoardBtn"
  ];

  ownerButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn && role !== "owner") {
      btn.style.display = "none";
    }
  });

  // Näkyvät vain memberille
const memberButtons = ["leaveBoardBtn"];

memberButtons.forEach(id => {
  const btn = document.getElementById(id);
  if (btn && role !== "member") {
    btn.style.display = "none";
  }
});

  console.log("INITBOARD CALLED");

  const boardName = getBoardName();

  loadMessage(true); // heti päivitys

  const boardNameEl = document.getElementById("boardTitle");
  const box = document.getElementById("boardMessagesDiv");

  if (!boardNameEl || !box || !boardName) return;

  boardNameEl.innerText = boardName;

  const leaveBtn = document.getElementById("leaveBoardBtn");

if (leaveBtn) {
  leaveBtn.style.display = "none";
}

updateEditModeUI();

if (refreshInterval) clearInterval(refreshInterval);

refreshInterval = setInterval(() => {
  if (!document.hidden) {
    loadMessage(false);
  }
}, 5000);

}

// =====================
// LOAD MESSAGES
// =====================

function loadMessage(forceScroll = false) {

  const box = document.getElementById("boardMessagesDiv");
  if (!box) return;

  if (loading) return;
  loading = true;

  const boardName = getBoardName();
  if (!boardName) {
    loading = false;
    return;
  }

  fetch(`http://localhost:3000/board/${boardName}`)
  .then(res => res.json())
  .then(data => {

  const requestButton = document.getElementById("requestsBtn");

  if (requestButton) {
    if (data.pendingRequests.length > 0) {
      requestButton.classList.add("pending");
    } else {
    requestButton.classList.remove("pending");
    }
  }

    currentButtonsCache = data.quickMessages ?? [];

    updateQuickUI(data);

    const isAtBottom =
    box.scrollTop + box.clientHeight >= box.scrollHeight - 10;

    box.innerHTML = "";

    const todayMode = document.getElementById("todayMode")?.checked;

    let messages = data.boardMessages;

    if (todayMode) {
    const now = new Date();

    messages = messages.filter(msg => {
    const d = new Date(msg.time);

    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
}

messages.forEach(msg => {

  //console.log("TYPE:", msg.type);
  const div = document.createElement("div");
  div.className = "msg-row";

  if (msg.type === "important") {
    div.classList.add("important-msg");
  }

  if (msg.type === "info") {
    div.classList.add("info-msg");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "msg-content";

  const text = document.createElement("div");
text.className = "msg-text";

const author = document.createElement("span");
author.className = "msg-author";
author.innerText = `${msg.author}:`;

const body = document.createElement("div");
body.className = "msg-body";
body.innerText = msg.text;

text.appendChild(author);
text.appendChild(body);

  const time = document.createElement("div");
  time.className = "msg-time";

  const date = new Date(msg.time);

  if (todayMode) {
    time.innerText = date.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
    });
  } else {
    time.innerText = date.toLocaleString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
    });
  }

  wrapper.appendChild(text);
  wrapper.appendChild(time);

  div.appendChild(wrapper);


  const editMode = document.getElementById("editMode")?.checked;
  const username = localStorage.getItem("boardUsername");

  const user = data.users.find(u => u.username === username);
  const owner = user?.role === "owner";

  const showTrash =
    editMode && (owner || msg.author === username);
    /*
    wrapper.appendChild(text);
    wrapper.appendChild(time);
    */
if (showTrash) {
    const trash = document.createElement("button");
    trash.innerText = "🗑";
    trash.className = "trash-btn";
    trash.onclick = () => deleteMessage(msg.id);

    wrapper.appendChild(trash);   // ← tänne
}

div.appendChild(wrapper);
   
  box.appendChild(div);
  });

    if (forceScroll || isAtBottom) {
      box.scrollTop = box.scrollHeight;
    }
  })
  .catch(console.error)
  .finally(() => {
    loading = false;
  });
  /*document.getElementById("boardNewMsg").blur();*/
}


// =====================
// UPDATE MESSAGE
// =====================

function updateMessage() {

  const messageEl = document.getElementById("boardNewMsg");

  if (!messageEl) return;

  const boardMessage = messageEl.value;

  const boardName = localStorage.getItem("boardName");
  const boardUsername = localStorage.getItem("boardUsername") || boardName;
  let type="normal";


  if (document.getElementById("importantMode").checked) {
  type = "important";
  }

  if (document.getElementById("infoMode").checked) { 
    type="info";
  }

  fetch("http://localhost:3000/boardMessage", {
    method: "POST",
    headers: {
  "Content-Type": "application/json",
  "Authorization": localStorage.getItem("token")
},
    body: JSON.stringify({
    boardName,
    boardMessage,
    boardUsername,
    type
})
  })
  .then(res => res.json())
  .then(data => {
     
    if (!data.success) return alert(data.boardMessage);

    messageEl.value = "";
    loadMessage(true);

    document.getElementById("boardNewMsg").blur();

    document.getElementById("importantMode").checked = false;
    document.getElementById("infoMode").checked = false;
    type="normal";
  });
  
}

/*
// =====================
// LOGIN
// =====================

function loginBoard() {

  const boardName = document.getElementById("boardName").value;
  const token = localStorage.getItem("token");

  if (token) {

    fetch("http://localhost:3000/authCheck", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({
        boardName
      })
    })
    .then(r => r.json())
    .then(data => {

      if (data.success) {
        localStorage.setItem("boardUsername", data.username);
        window.location.href = "board.html";
        return;
      }

      // token ei enää kelpaa
      localStorage.removeItem("token");

      // kirjaudu salasanalla
      loginWithPassword();
    });

    return;
  }

  // 👇 jos tokenia ei ole
  loginWithPassword();
}*/

function loginWithPassword() {

  const boardName = document.getElementById("boardName").value;
  const boardPassword = document.getElementById("boardPassword").value;
  const boardUsername = document.getElementById("boardUsername").value;

  fetch("http://localhost:3000/login", {
    method: "POST",
    headers: {
  "Content-Type": "application/json"
  },
    body: JSON.stringify({
    boardName,
    boardUsername,
    boardPassword
})
    })
  .then(res => res.json())
  .then(async data => {

    if (!data.success) {
      return alert("Login failed");
    }

    // ✔ token talteen
    localStorage.setItem("token", data.token);
    localStorage.setItem("boardName", boardName);
    localStorage.setItem("boardUsername", boardUsername);
    localStorage.setItem("role", data.role);

    await fetch("http://localhost:3000/visit", {
      method: "POST",
      headers: {
  "Content-Type": "application/json"
},
      body: JSON.stringify({
        boardName,
        boardUsername
      })
    });

    window.location.href = "board.html";
  });
} 

// =====================
// DELETE BOARD
// =====================

function deleteBoard() {
  const boardName = localStorage.getItem("boardName");
  const token = localStorage.getItem("token");

  fetch(`http://localhost:3000/delete/${boardName}`, {
    method: "DELETE",
    headers: {
      "Authorization": token
    }
  })
  .then(async (res) => {
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      alert(data?.message || "Delete failed (no permission or server error)");
      return;
    }

    localStorage.clear();
    window.location.href = "index.html";
  })
  .catch(err => {
    console.error(err);
    alert("Network error");
  });
}

function deleteUser() {

  const ok = confirm(
    "Are you sure you want to leave this board?\n\nYour user account will be removed from this board."
  );

  if (!ok) {
    return;
  }

  const boardName = localStorage.getItem("boardName");
  const token = localStorage.getItem("token");

  fetch(`http://localhost:3000/deleteUser/${boardName}`, {
    method: "DELETE",
    headers: {
      "Authorization": token
    }
  })
  .then(async (res) => {
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      alert(data?.message || "Delete failed");
      return;
    }

    localStorage.clear();
    window.location.href = "index.html";
  })
  .catch(err => {
    console.error(err);
    alert("Network error");
  });
}


// =====================
// CLEAR TABLE
// =====================

function clearTable() {
  if (!confirm("Tyhjennetäänkö kaikki viestit?")) return;

  fetch(`http://localhost:3000/clear/${localStorage.getItem("boardName")}`, {
    method: "DELETE",
    headers: {
      "Authorization": localStorage.getItem("token")
    }
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message);
    if (data.success) loadMessage(true);
  });
}

// =====================
// NAV
// =====================

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

function saveQuickMessage() {

  console.log("SAVE QUICK CALLED", editingIndex);

  if (editingIndex === null) {
    alert("Valitse ensin Edit-moodi");
    return;
  }

  const text =
    document.getElementById("boardNewMsg").value.trim();

  const boardName = localStorage.getItem("boardName");
  const token = localStorage.getItem("token");

  console.log("SAVE QUICK DATA", {
  boardName,
  index: editingIndex,
  text
});

fetch("http://localhost:3000/quickMessages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": token
  },
  body: JSON.stringify({
    boardName,
    index: editingIndex,
    text
  })
})
  .then(res => res.json())
  .then(data => {

     console.log("SAVE RESPONSE", data);

    if (!data.success) {
      alert(data.message);
      return;
    }

    document.getElementById("boardNewMsg").value = "";

    editingIndex = null;

    const edit = document.getElementById("editMode");

    if (edit) {
      edit.checked = false;
      edit.dispatchEvent(new Event("change"));
    }

    loadMessage(true);
});
}

function loadBoardCount() {

  const el = document.getElementById("boardCount");
  if (!el) return;

  el.innerText = "Ladataan...";

  fetch("http://localhost:3000/boards/count")
    .then(res => res.json())
    .then(data => {
      el.innerText = `Boards: ${data.count ?? 0}`;
    })
    .catch(() => {
      el.innerText = "Cannot get Boards";
    });
}

function deleteMessage(id) {
  if (!confirm("Oletko varma että haluat poistaa viestin?")) {
    return;
  }

  const boardName = localStorage.getItem("boardName");
  const token = localStorage.getItem("token");

  fetch(`http://localhost:3000/message/${boardName}/${id}`, {
    method: "DELETE",
    headers: {
    "Content-Type":"application/json",
    "Authorization":token
},
    body: JSON.stringify({
    boardName
})
  })
  .then(res => res.json())
  .then(data => {
    loadMessage(true);
  });
}

function renderVisitedUsers(users) {

  const el = document.getElementById("visitedUsers");
  if (!el) return;

  const sorted = (users || [])
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 5);

  const loggedUser = localStorage.getItem("boardUsername") || "";

  el.innerHTML =
  `👤 Logged in: <b>${loggedUser}</b>&nbsp;&nbsp;&nbsp;&nbsp;🟢 Last visited: ` +
  sorted.map(u => u.name).join(", ");
}

function updateQuickUI(data) {
  currentButtonsCache = data.quickMessages ?? [];

  renderVisitedUsers(data.visitedUsers);
  renderQuickSelect(currentButtonsCache);

}

function openSettings() {
  console.log("OPEN SETTINGS TRIGGERED BY CLICK");
  //();

  const boardName =
    localStorage.getItem("boardName");

  /*
  fetch("http://localhost:3000/board/" + boardName)
  */

  fetch(`http://localhost:3000/board/${boardName}`)
    .then(res => res.json())
    .then(board => {

      document.getElementById(
        "autoDeleteDays"
      ).value =
        board.autoDeleteDays ?? 10;

      document.getElementById(
        "settingsPopup"
      ).style.display = "block";
    });
}

function closeSettings() {

  document.getElementById(
    "settingsPopup"
  ).style.display = "none";
}

function saveSettings() {

  const boardName =
    localStorage.getItem("boardName");

  const token = localStorage.getItem("token");

  const autoDeleteDays =
    Number(
      document.getElementById(
        "autoDeleteDays"
      ).value
    );

  fetch("http://localhost:3000/settings", {
    method: "POST",
    headers:{
   "Content-Type":"application/json",
   "Authorization":token
},
    body:JSON.stringify({
    boardName,
    autoDeleteDays
})
  })
  .then(res => res.json())
  .then(data => {

    if (data.success) {
      alert("Tallennettu!");
      closeSettings();
    }
  });
}

function getCurrentUsername() {
  
  console.log("INPUT username:", document.getElementById("boardUsername")?.value);
  return document.getElementById("boardUsername")?.value
    || localStorage.getItem("boardUsername");
}

const importantMode = document.getElementById("importantMode");

if (importantMode) {
  importantMode.addEventListener("change", function () {

    if (this.checked) {
      document.getElementById("infoMode").checked = false;
    }

  });
}


const infoMode = document.getElementById("infoMode");

if (infoMode) {
  infoMode.addEventListener("change", function () {

    if (this.checked) {
      document.getElementById("importantMode").checked = false;
    }

  });
}

document.getElementById("editMode")?.addEventListener("change", () => {
    updateEditModeUI();
    loadMessage(false);
});

const membersPopup = document.getElementById("membersPopup");

if (membersPopup) {
  membersPopup.addEventListener("click", (e) => {
    if (e.target.id === "membersPopup") {
      closeMembers();
    }
  });
}

const settingsPopup = document.getElementById("settingsPopup");

if (settingsPopup) {
  settingsPopup.addEventListener("click", (e) => {
    if (e.target.id === "settingsPopup") {
      closeSettings();
    }
  });
}

function showMembers() {
  
  console.log("SHOW MEMBERS TRIGGERED BY CLICK");
  
  const boardName = localStorage.getItem("boardName");

  fetch(`http://localhost:3000/board/${boardName}`)
    .then(res => res.json())
    .then(board => {

      const el = document.getElementById("membersList");
      const popup = document.getElementById("membersPopup");

      if (!el || !popup) return;

      const members = board.users || [];
      const owners = members.filter(m => m.role === "owner");
      const others = members.filter(m => m.role !== "owner");
      const editMode = document.getElementById("editMode")?.checked;
      const owner = localStorage.getItem("role") === "owner";

      console.log("members: ",members);
      console.log("owner:", owner);
console.log("editMode:", editMode);

      el.innerHTML =
      owners.map(m => `
        <div class="member-owner">
            ${m.username}
            <span class="member-role">(${m.role})</span>
        </div>
      `).join("") +

    `<div class="member-grid">
       ${others.map(m => `
    <div class="member-row">
        ${m.username}
        <span class="member-role">(${m.role})</span>

        ${owner && editMode
          ? `<button
  class="member-trash-btn"
  onclick="removeMember('${m.username}')">
  🗑
</button>`
          : ""}
    </div>
`).join("")}
    </div>`;

      popup.style.display = "block";
    });
}

function closeMembers() {
  document.getElementById("membersPopup").style.display = "none";
}

function openJoinBoard() {
  document.getElementById("joinBoardPopup").style.display = "flex";
}

function closeJoinBoard() {
  console.log("CLOSE JOIN POPUP");
  document.getElementById("joinBoardPopup").style.display = "none";
}

function sendJoinRequest() {

  const boardName = document.getElementById("joinBoardName").value;
  const username = document.getElementById("joinUsername").value;
  const password = document.getElementById("joinPassword").value;
  const email = document.getElementById("joinEmail").value;

  console.log(boardName, username, email);

  fetch("http://localhost:3000/joinRequest", {
    method: "POST",
    headers: {
  "Content-Type": "application/json"
},
    body: JSON.stringify({
      boardName,
      username,
      password,
      email
    })
  })
  .then(res => res.json())
  .then(data => {

    if (!data.success) {
        alert(data.message || "Join request failed");
        return;
    }

    alert("Join request sent!");

    document.getElementById("joinBoardName").value = "";
    document.getElementById("joinUsername").value = "";
    document.getElementById("joinPassword").value = "";
    document.getElementById("joinEmail").value = "";

    closeJoinBoard();

})
  .catch(err => {
    console.error(err);
    alert("Server error");
  });

}

function openCreatePopup() {
  document.getElementById("createPopup").style.display = "flex";
}

function closeCreatePopup() {
  document.getElementById("createPopup").style.display = "none";
}

function submitCreateBoard() {

  const boardName = document.getElementById("cp_boardName").value;
  const boardUsername = document.getElementById("cp_username").value;
  const ownerEmail = document.getElementById("cp_email").value;
  const boardPassword = document.getElementById("cp_boardPassword").value;

  fetch("http://localhost:3000/create", {
    method: "POST",
    headers: {
    "Content-Type": "application/json"
  },
    body: JSON.stringify({
      boardName,
      boardUsername, 
      boardPassword,
      ownerEmail,
    })
  })
  .then(r => r.json())
  .then(data => {
    alert(data.message);

    if (data.success) {

      loadBoardCount();      // <-- tämä
      document.getElementById("cp_boardName").value = "";
      document.getElementById("cp_username").value = "";
      document.getElementById("cp_email").value = "";
      document.getElementById("cp_boardPassword").value = "";
      closeCreatePopup();

      localStorage.setItem("boardName", boardName);
      localStorage.setItem("boardPassword", boardPassword);
      localStorage.setItem("boardUsername", boardUsername);
    }
  });
}

function openRequests() {
  console.log("OPEN REQUESTS");
  document.getElementById("requestsPopup").style.display = "block";
  console.log("LOAD REQUESTS FROM OPEN");
  loadRequests();
}

function closeRequests() {
  console.trace("CLOSE REQUESTS");
  document.getElementById("requestsPopup").style.display = "none";
}

function loadRequests() {

  console.log("LOAD REQUESTS");

  const boardName = localStorage.getItem("boardName");

  fetch(`http://localhost:3000/board/${boardName}`)
    .then(res => res.json())
    .then(board => {

  const list = document.getElementById("requestsList");
  list.innerHTML = "";

  if (!board.pendingRequests || board.pendingRequests.length === 0) {

    list.innerHTML = "<b>No pending requests.</b>";

    setTimeout(() => {
      closeRequests();
    }, 1500);

    return;
  }

  board.pendingRequests.forEach(req => {

    const div = document.createElement("div");

    div.innerHTML = `
      <div><b>Username:</b> ${req.username}</div>
      <div><b>Email:</b> ${req.email}</div>
      <br>

      <button type="button"
        onclick="acceptRequest('${req.id}', event)">
        Accept
      </button>

      <button type="button"
        onclick="rejectRequest('${req.id}')">
        Reject
      </button>

      <hr>
    `;

    list.appendChild(div);
  });

});
}

function acceptRequest(id, event) {
  
  const role = localStorage.getItem("role");
  if (role !== "owner") return;

  event?.preventDefault();
  event?.stopPropagation();

  fetch("http://localhost:3000/acceptRequest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": localStorage.getItem("token")
    },
    body: JSON.stringify({
      boardName: localStorage.getItem("boardName"),
      id
    })
  })
  .then(() => {
    console.log("LOAD REQUESTS FROM THEN");
    loadRequests(); 
});
}

function rejectRequest(id) {

  const boardName = localStorage.getItem("boardName");

  fetch(`http://localhost:3000/rejectRequest`, {
    method: "POST",
    headers: {
  "Content-Type": "application/json",
  "Authorization": localStorage.getItem("token")
},
    body: JSON.stringify({ boardName, id })
  })
  .then(() => {
    console.log("LOAD REQUESTS FROM THEN");
    loadRequests(); 
});
}

const menuBtn = document.getElementById("menuBtn");
const topMenu = document.getElementById("topMenu");

if (menuBtn && topMenu) {
  menuBtn.onclick = () => {
    topMenu.classList.toggle("open");
  };
}

document.addEventListener("click", function(e) {

  // Jos klikattiin menupainiketta, ei tehdä mitään
  if (menuBtn.contains(e.target)) return;

  // Jos klikattiin valikon ulkopuolelle, sulje valikko
  if (!topMenu.contains(e.target)) {
    topMenu.classList.remove("open");
  }

  

});



const quickMessagesPopup = document.getElementById("quickMessagesPopup");

if (quickMessagesPopup) {
  quickMessagesPopup.addEventListener("click", function(e) {
    if (e.target === this) {
      closeQuickMessages();
    }
  });
}

const requestsPopup = document.getElementById("requestsPopup");

if (requestsPopup) {
  requestsPopup.addEventListener("click", function(e) {
    if (e.target === this) {
      closeRequests();
    }
  });
}

function removeMember(username) {

  if (!confirm(`Poistetaanko käyttäjä ${username}?`)) {
    return;
  }

  const boardName = localStorage.getItem("boardName");
  const token = localStorage.getItem("token");

  fetch("http://localhost:3000/removeMember", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({
      boardName,
      username
    })
  })
  .then(res => res.json())
  .then(data => {

    if (!data.success) {
      alert(data.message || "Remove failed");
      return;
    }

    showMembers();
    loadMessage(false);
  });
}

/*
document.getElementById("editMode")?.addEventListener("change", updateEditModeUI);
*/

function openQuickMessages() {
    document.getElementById("quickMessagesPopup").style.display = "block";
    renderQuickPopup();
}

function closeQuickMessages() {
    document.getElementById("quickMessagesPopup").style.display = "none";
}

function renderQuickPopup(){

  console.log("SHOW QUICK MESSAGES TRIGGERED BY CLICK");

  const saveBtn = document.getElementById("saveQuickBtn");
  const editMode = document.getElementById("editMode")?.checked;

  if (saveBtn) {
    saveBtn.style.display = editMode ? "inline-block" : "none";
  }

  const boardName = localStorage.getItem("boardName");

  fetch(`http://localhost:3000/board/${boardName}`)
    .then(res => res.json())
    .then(board => {

      const el = document.getElementById("quickMessagesList");
      const popup = document.getElementById("quickMessagesPopup");

      if (!el || !popup) return;

      const quickMessages = board.quickMessages || [];

      if (editMode) {

  el.innerHTML =
    quickMessages.map((msg, index) => `
      <input class="quick-input" value="${msg}">
    `).join("");

} else {

  el.innerHTML =
    quickMessages.map((msg, index) => `
      <div class="quick-row" onclick="sendQuickMessage('${msg}')">
        ${msg}
      </div>
    `).join("");


      }

      popup.style.display = "block";
    });
} 

function sendQuickMessage(msg) {
    document.getElementById("boardNewMsg").value = msg;
    updateMessage();
    closeQuickMessages();
}

function saveQuickMessages() {

  const inputs = document.querySelectorAll(".quick-input");

  const quickMessages = Array.from(inputs)
    .map(input => input.value.trim());

  if (quickMessages.some(msg => msg === "")) {
    alert("Pikaviesti ei voi olla tyhjä");
    return;
  }

  const boardName = localStorage.getItem("boardName");

  fetch("http://localhost:3000/quickMessages/saveAll", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": localStorage.getItem("token")
    },
    body: JSON.stringify({
      boardName,
      quickMessages
    })
  })
  .then(res => res.json())
  .then(data => {

    if (!data.success) {
      alert(data.message || "Tallennus epäonnistui");
      return;
    }

    document.getElementById("editMode").checked = false;
    closeQuickMessages();
    loadMessage(false);

  })
  .catch(err => {
    console.error(err);
    alert("Virhe tallennuksessa");
  });

}

function updateEditModeUI() {
    const editMode = document.getElementById("editMode")?.checked;
    const role = localStorage.getItem("role");
    const sendBtn = document.getElementById("sendBtn");
    const leaveBtn = document.getElementById("leaveBoardBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const deleteBoardBtn = document.getElementById("deleteBoardBtn");

  if (!sendBtn) return;

  if (leaveBtn) {
    leaveBtn.style.display =
  (role === "member" && editMode)
    ? "block"
    : "none";
  }

  if (editMode) {

    sendBtn.textContent = "Save";
    sendBtn.onclick = saveQuickMessage;

} else {

    sendBtn.textContent = "Send";
    sendBtn.onclick = updateMessage;
    editingIndex = null;
}

  if (settingsBtn) {
  settingsBtn.style.display =
  (role === "owner" && editMode)
    ? "block"
    : "none";
}

if (deleteBoardBtn) {
  deleteBoardBtn.style.display =
  (role === "owner" && editMode)
    ? "block"
    : "none";
}
}