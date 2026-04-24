require("dotenv").config();
const express = require("express");
const stripe = require("./stripe");

const app = express();

/**
 * IMPORTANT ORDER
 */
app.use(express.json()); // for normal routes

let sessions = {};