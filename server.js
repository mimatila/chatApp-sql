const express = require("express");
const cors = require("cors");
const app = express();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "mimatila",
  password: "Ollikuhta70",
  database: "chatApp",
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("MariaDB connected!");
    conn.release();
  } catch (err) {
    console.error(err);
  }
})();

// 🔥 CORS ENSIN
app.use(cors());

// sitten JSON parsing
app.use(express.json());

app.post("/login", async (req, res) => {

  const { boardName, boardUsername, boardPassword } = req.body;

  try {

    // Hae käyttäjä ja board yhdellä kyselyllä
    const [rows] = await pool.query(
  `SELECT users.id,
       users.password,
       users.role,
       users.username,
       boards.boardType
   FROM users
   JOIN boards
     ON users.board_id = boards.id
   WHERE boards.name = ?
     AND BINARY users.username = BINARY ?`,
  [boardName, boardUsername]
);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Board or user not found"
      });
    }

    const user = rows[0];

    const ok = await bcrypt.compare(
  boardPassword,
  user.password
);

if (!ok) {
  return res.status(401).json({
    success: false,
    message: "Invalid login"
  });
}

    const token = crypto.randomUUID();

    await pool.query(
      "UPDATE users SET token = ? WHERE id = ?",
      [token, user.id]
    );

    res.json({
  success: true,
  token,
  username: user.username,
  role: user.role,
  boardType: user.boardType
});

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/create", async (req, res) => {

  const {
    boardName,
    boardType,
    boardUsername,
    boardPassword,
    ownerEmail
  } = req.body;

  const quickMessages = [
    "Kaupassa",
    "Töissä",
    "Kotona",
    "Nukkumassa",
    "Syömässä",
    "Tulossa",
    "Myöhässä",
    "Sairas",
    "Tauolla",
    "Kuntosalilla"
  ];

  const connection = await pool.getConnection();

  try {

    await connection.beginTransaction();

    // Onko board jo olemassa?
    const [boards] = await connection.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Taulu on jo olemassa"
      });
    }

    // Luo board
const [boardResult] = await connection.query(
  "INSERT INTO boards (name, boardType) VALUES (?, ?)",
  [boardName, boardType]
);

const boardId = boardResult.insertId;

    // Luo settings oletusarvolla 10 päivää
    await connection.query(
    `INSERT INTO settings
    (board_id, autoDeleteDays)
    VALUES (?, ?)`,
    [boardId, 10]
    );


    const hash = await bcrypt.hash(boardPassword, 10);
    
    // Luo owner
    await connection.query(
  `INSERT INTO users
   (board_id, username, password, email, role, token)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    boardId,
    boardUsername,
    hash,
    ownerEmail,
    "owner",
    null
  ]
);

    // Lisää quickMessages
    for (const msg of quickMessages) {
      await connection.query(
        `INSERT INTO quickMessages
        (board_id, message)
        VALUES (?, ?)`,
        [
          boardId,
          msg
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Board created!"
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  } finally {

    connection.release();

  }

});

app.delete("/delete/:boardName", async (req, res) => {

  const boardName = req.params.boardName;

  const user = await authUser(req, boardName);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Kirjaudu uudelleen"
    });
  }

  if (user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Not owner"
    });
  }

  const connection = await pool.getConnection();

  try {

    await connection.beginTransaction();

    // Hae board_id
    const [boards] = await connection.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Taulua ei löytynyt"
      });
    }

    const boardId = boards[0].id;

    await connection.query(
  "DELETE FROM boards WHERE id = ?",
  [boardId]
);

    await connection.commit();

    res.json({
      success: true,
      message: "Taulu poistettu"
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  } finally {

    connection.release();

  }

});

app.delete("/leaveBoard/:boardName", async (req, res) => {

  const boardName = req.params.boardName;

  const user = await authUser(req, boardName);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Kirjaudu uudelleen"
    });
  }

  const connection = await pool.getConnection();

  try {

    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM users WHERE id = ?",
      [user.id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "User deleted"
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  } finally {

    connection.release();

  }

});

app.post("/boardMessage", async (req, res) => {

  const {
    boardName,
    author,
    category,
    topic,
    message,
    type
  } = req.body;

  console.log("BOARD MESSAGE DATA:", {
    boardName,
    author,
    category,
    topic,
    message,
    type
  });


 const [boards] = await pool.query(
    "SELECT id, boardType FROM boards WHERE name = ?",
    [boardName]
);

if (boards.length === 0) {
    return res.json({
        success: false,
        message: "Board not found"
    });
}

  const boardId = boards[0].id;
  const boardType = boards[0].boardType;

  // TÄHÄN TOPIC-TARKISTUS

  if (boardType === "notice") {

  const [topics] = await pool.query(
    `
    SELECT id
    FROM boardMessages
    WHERE board_id = ?
    AND category = ?
    AND topic = ?
    LIMIT 1
    `,
    [
      boardId,
      category,
      topic
    ]
  );


  if (topics.length === 0) {
    return res.json({
      success: false,
      message: "Topic not found"
    });
  }
  }


  // vasta nyt tallennetaan viesti

  await pool.query(
    `
    INSERT INTO boardMessages
    (id, board_id, author, time, text, type, category, topic)
    VALUES (UUID(), ?, ?, NOW(), ?, ?, ?, ?)
    `,
    [
      boardId,
      author,
      message,
      type,
      category,
      topic
    ]
  );


  res.json({
    success: true,
    message: "Message added"
  });

});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/board/:boardName", async (req, res) => {

  const boardName = req.params.boardName;

  try {

    // Hae board
    const [boards] = await pool.query(
  "SELECT id, boardType FROM boards WHERE name = ?",
  [boardName]
);

    if (boards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Taulua ei löydy"
      });
    }

    const boardId = boards[0].id;

    // Hae käyttäjät
    const [users] = await pool.query(
      `SELECT username, email, role, token
       FROM users
       WHERE board_id = ?`,
      [boardId]
    );

    // Hae viestit
    const [boardMessages] = await pool.query(
  `SELECT id, author, time, text, type, category, topic
   FROM boardMessages
   WHERE board_id = ?
   ORDER BY time`,
  [boardId]
);

    // Hae liittymispyynnöt
    const [pendingRequests] = await pool.query(
      `SELECT id, username, password, email, status, time
       FROM pendingRequests
       WHERE board_id = ?`,
      [boardId]
    );

    // Hae asetukset
    const [settings] = await pool.query(
      `SELECT autoDeleteDays
       FROM settings
       WHERE board_id = ?`,
      [boardId]
    );

    // Hae pikaviestit
    const [quickMessages] = await pool.query(
      `SELECT message
       FROM quickMessages
       WHERE board_id = ?
       ORDER BY id`,
      [boardId]
    );

    // Hae viimeksi nähdyt käyttäjät
    const [visitedUsers] = await pool.query(
      `SELECT name, lastSeen
       FROM visitedUsers
       WHERE board_id = ?`,
      [boardId]
    );

    // Rakennetaan sama JSON kuin ennen
    const board = {

      boardType: boards[0].boardType,

      users,

      boardMessages,

      pendingRequests,

      autoDeleteDays:
        settings.length > 0
          ? settings[0].autoDeleteDays
          : 10,

      quickMessages:
        quickMessages.map(q => q.message),

      visitedUsers

    };

    res.json(board);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/loadMessages", async (req, res) => {

  console.log("LOAD MESSAGES:", req.body);

    const {
        boardName,
        category,
        topic
    } = req.body;

    try {

        // hae board_id
        const [boards] = await pool.query(
            "SELECT id FROM boards WHERE name = ?",
            [boardName]
        );

        if (boards.length === 0) {
            return res.json({
                success: false,
                message: "Board not found"
            });
        }

        const boardId = boards[0].id;

        // hae vain tämän topicin viestit
        const [boardMessages] = await pool.query(
            `
            SELECT id,
                   author,
                   time,
                   text,
                   type
            FROM boardMessages
            WHERE board_id = ?
              AND category = ?
              AND topic = ?
            ORDER BY time
            `,
            [
                boardId,
                category,
                topic
            ]
        );

        res.json({
            success: true,
            boardMessages
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Database error"
        });

    }

});

app.get("/boards", async (req, res) => {

  try {

    const [boards] = await pool.query(
      "SELECT name FROM boards ORDER BY name"
    );

    res.json(boards);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.delete("/clear/:boardName", async (req, res) => {

  const boardName = req.params.boardName;

  try {

    const user = await authUser(req, boardName);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Kirjaudu uudelleen"
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Ei oikeuksia"
      });
    }

    // Hae board_id
    const [boards] = await pool.query(
      "SELECT id, boardType FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Taulua ei löytynyt"
      });
    }

    const boardId = boards[0].id;
    const boardType = boards[0].boardType;

    // Poista kaikki viestit
    const { category, topic } = req.body;

if (boardType === "notice") {

  await pool.query(
    `DELETE FROM boardMessages
     WHERE board_id = ?
     AND category = ?
     AND topic = ?`,
    [
      boardId,
      category,
      topic
    ]
  );

} else {

  await pool.query(
    "DELETE FROM boardMessages WHERE board_id = ?",
    [boardId]
  );

}

    res.json({
      success: true,
      message: "Viestit tyhjennetty"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.get("/boards/count", async (req, res) => {

  try {

    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM boards"
    );

    res.json({
      count: rows[0].count
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/quickMessages/saveAll", async (req, res) => {

  const { boardName, quickMessages } = req.body;

  try {

    const user = await authUser(req, boardName);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Kirjaudu uudelleen"
      });
    }

    // Hae board_id
    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false
      });
    }

    const boardId = boards[0].id;

    // Päivitä pikaviesti
    const [rows] = await pool.query(
  `SELECT id
   FROM quickMessages
   WHERE board_id = ?
   ORDER BY id`,
  [boardId]
);

if (!Array.isArray(quickMessages) || quickMessages.length !== 10) {
  return res.status(400).json({
    success: false,
    message: "Invalid quick messages"
  });
}

if (quickMessages.some(msg => msg.trim() === "")) {
  return res.status(400).json({
    success: false,
    message: "Pikaviesti ei voi olla tyhjä"
  });
}

for (let i = 0; i < quickMessages.length; i++) {

  await pool.query(
    `UPDATE quickMessages
     SET message = ?
     WHERE id = ?
     AND board_id = ?`,
    [
      quickMessages[i],
      rows[i].id,
      boardId
    ]
  );

}

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.delete("/message/:boardName/:id", async (req, res) => {

  const { boardName, id } = req.params;

  try {

    const user = await authUser(req, boardName);

    if (!user) {
      return res.status(401).json({
        success: false
      });
    }

    // Hae viesti
    const [rows] = await pool.query(
      `SELECT
          boardMessages.author,
          boardMessages.board_id
       FROM boardMessages
       JOIN boards
         ON boardMessages.board_id = boards.id
       WHERE boards.name = ?
         AND boardMessages.id = ?`,
      [boardName, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false
      });
    }

    const message = rows[0];

    // Owner saa poistaa kaiken,
    // muut vain omat viestinsä
    if (
      user.role !== "owner" &&
      message.author !== user.username
    ) {
      return res.status(403).json({
        success: false,
        message: "Ei oikeuksia"
      });
    }

    // Poista viesti
    await pool.query(
      `DELETE FROM boardMessages
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/visit", async (req, res) => {

  const { boardName, boardUsername } = req.body;

  try {

    // Hae board_id
    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false
      });
    }

    const boardId = boards[0].id;

    // Onko käyttäjä jo olemassa?
    const [rows] = await pool.query(
      `SELECT id
       FROM visitedUsers
       WHERE board_id = ?
       AND name = ?`,
      [boardId, boardUsername]
    );

    if (rows.length > 0) {

      // Päivitä aika
      await pool.query(
        `UPDATE visitedUsers
         SET lastSeen = ?
         WHERE board_id = ?
         AND name = ?`,
        [Date.now(), boardId, boardUsername]
      );

    } else {

      // Lisää uusi
      await pool.query(
        `INSERT INTO visitedUsers
        (board_id, name, lastSeen)
        VALUES (?, ?, ?)`,
        [boardId, boardUsername, Date.now()]
      );

    }

    // Säilytetään vain 5 uusinta
    await pool.query(
      `DELETE FROM visitedUsers
       WHERE board_id = ?
       AND id NOT IN (
         SELECT id
         FROM (
           SELECT id
           FROM visitedUsers
           WHERE board_id = ?
           ORDER BY lastSeen DESC
           LIMIT 5
         ) AS latest
       )`,
      [boardId, boardId]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/settings", async (req, res) => {

  const {
    boardName,
    autoDeleteDays
  } = req.body;

  try {

    const user = await authUser(req, boardName);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Kirjaudu uudelleen"
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Ei oikeuksia"
      });
    }

    // Hae board_id
    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false
      });
    }

    const boardId = boards[0].id;

    // Päivitä asetus
    await pool.query(
      `UPDATE settings
       SET autoDeleteDays = ?
       WHERE board_id = ?`,
      [
        Number(autoDeleteDays),
        boardId
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/joinRequest", async (req, res) => {

  const { boardName, username, password, email } = req.body;

  try {

    // Hae board
    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Board not found"
      });
    }

    const boardId = boards[0].id;

    // Onko käyttäjä jo olemassa?
    const [users] = await pool.query(
      `SELECT id
       FROM users
       WHERE board_id = ?
       AND username = ?`,
      [boardId, username]
    );

    if (users.length > 0) {
      return res.json({
        success: false,
        message: "Username already exists."
      });
    }

    // Onko liittymispyyntö jo olemassa?
    const [requests] = await pool.query(
      `SELECT id
       FROM pendingRequests
       WHERE board_id = ?
       AND (username = ? OR email = ?)`,
      [boardId, username, email]
    );

    if (requests.length > 0) {
      return res.json({
        success: false,
        message: "Request already pending"
      });
    }

    // Lisää liittymispyyntö
    
const hash = await bcrypt.hash(password, 10);

await pool.query(
  `INSERT INTO pendingRequests
  (id, board_id, username, password, email, status, time)
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [
    crypto.randomUUID(),
    boardId,
    username,
    hash,          // ← hash, ei password
    email,
    "pending",
    new Date()
  ]
);

    res.json({
      success: true,
      message: "Request sent"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/acceptRequest", async (req, res) => {

  const { boardName, id } = req.body;

  const connection = await pool.getConnection();

  try {

    await connection.beginTransaction();

    // Hae liittymispyyntö
    const [rows] = await connection.query(
      `SELECT
          pendingRequests.*,
          boards.id AS board_id
       FROM pendingRequests
       JOIN boards
         ON pendingRequests.board_id = boards.id
       WHERE boards.name = ?
         AND pendingRequests.id = ?`,
      [boardName, id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false
      });
    }

    const request = rows[0];

    // Lisää käyttäjä
    await connection.query(
  `INSERT INTO users
   (board_id, username, email, password, role, token)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    request.board_id,
    request.username,
    request.email,
    request.password,   // tämä on jo hash
    "member",
    null
  ]
);

    // Poista liittymispyyntö
    await connection.query(
      `DELETE FROM pendingRequests
       WHERE id = ?`,
      [id]
    );

    await connection.commit();

    res.json({
      success: true
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({
      success: false
    });

  } finally {

    connection.release();

  }

});

app.post("/rejectRequest", async (req, res) => {

  const { boardName, id } = req.body;
  const token = req.headers.authorization;

  try {

    // Tarkista että token kuuluu ownerille tässä boardissa
    const [owners] = await pool.query(
      `SELECT users.id
       FROM users
       JOIN boards
         ON users.board_id = boards.id
       WHERE boards.name = ?
         AND users.token = ?
         AND users.role = 'owner'`,
      [boardName, token]
    );

    if (owners.length === 0) {
      return res.status(403).json({
        success: false
      });
    }

    // Poista liittymispyyntö
    const [result] = await pool.query(
      `DELETE pendingRequests
       FROM pendingRequests
       JOIN boards
         ON pendingRequests.board_id = boards.id
       WHERE boards.name = ?
         AND pendingRequests.id = ?`,
      [boardName, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false
      });
    }

    res.json({
      success: true,
      message: "Request rejected"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/authCheck", async (req, res) => {

  console.log("authCheck RUN");

  const { boardName } = req.body;

  try {

    const user = await authUser(req, boardName);

    if (!user) {
      return res.status(401).json({
        success: false
      });
    }

    res.json({
      success: true,
      username: user.username,
      role: user.role
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

async function authUser(req, boardName) {

    const token = req.headers.authorization;

    if (!token) {
        return null;
    }

    const [rows] = await pool.query(
        `SELECT users.*
         FROM users
         JOIN boards
           ON users.board_id = boards.id
         WHERE boards.name = ?
           AND users.token = ?`,
        [boardName, token]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
}

app.post("/removeMember", async (req, res) => {

  const { boardName, username } = req.body;

  try {

    const owner = await authUser(req, boardName);

    if (!owner || owner.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only owner can remove members"
      });
    }

    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Board not found"
      });
    }

    const boardId = boards[0].id;


    const [result] = await pool.query(
      `DELETE FROM users
       WHERE board_id = ?
       AND username = ?
       AND role = 'member'`,
      [boardId, username]
    );


    if (result.affectedRows === 0) {
      return res.json({
        success: false,
        message: "Member not found"
      });
    }


    res.json({
      success: true
    });


  } catch(err) {

    console.error(err);

    res.status(500).json({
      success:false,
      message:"Database error"
    });

  }

});

app.post("/createTopic", async (req, res) => {

  const {
    boardName,
    author,
    category,
    topic,
    message,
    type
  } = req.body;

  try {

    // Hae board_id
    const [boards] = await pool.query(
      "SELECT id FROM boards WHERE name = ?",
      [boardName]
    );

    if (boards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Board not found"
      });
    }

    const boardId = boards[0].id;

    await pool.query(
      `INSERT INTO boardMessages
      (id, board_id, author, time, text, type, category, topic)
      VALUES (UUID(), ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        boardId,
        author,
        message,
        type,
        category,
        topic
      ]
    );

    res.json({
      success: true,
      message: "Topic created"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Database error"
    });

  }

});

app.post("/topics", async (req,res)=>{

  const { boardName, category } = req.body;

  const [rows] = await pool.query(
    `
    SELECT DISTINCT topic
    FROM boardMessages
    WHERE board_id = (
      SELECT id FROM boards WHERE name = ?
    )
    AND category = ?
    AND topic IS NOT NULL
    `,
    [boardName, category]
  );

  res.json({
    topics: rows.map(r => r.topic)
  });

});

app.listen(3000, () => {
  console.log("Serveri käynnissä portissa 3000");
});