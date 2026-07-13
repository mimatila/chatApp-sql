CREATE DATABASE chatApp;

USE chatApp;

CREATE TABLE boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT,
    username VARCHAR(50),
    password VARCHAR(255),
    email VARCHAR(100),
    role VARCHAR(20),
    token VARCHAR(100),

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

CREATE TABLE boardMessages (
    id VARCHAR(36) PRIMARY KEY,
    board_id INT,
    author VARCHAR(50),
    time DATETIME,
    text TEXT,
    type VARCHAR(20),

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

CREATE TABLE pendingRequests (
    id VARCHAR(36) PRIMARY KEY,
    board_id INT,
    username VARCHAR(50),
    password VARCHAR(255),
    email VARCHAR(100),
    status VARCHAR(20),
    time DATETIME,

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT,
    autoDeleteDays INT,

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

CREATE TABLE quickMessages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT,
    message VARCHAR(100),

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

CREATE TABLE visitedUsers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT,
    name VARCHAR(50),
    lastSeen BIGINT,

    FOREIGN KEY (board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);
