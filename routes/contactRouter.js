const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contact.Controller");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
router.get("/", authMiddleware, isAdmin, contactController.getAllContacts);
router.get("/:id", authMiddleware, isAdmin, contactController.getContactById);
router.post("/", authMiddleware, contactController.createContact);
router.delete("/:id", authMiddleware, isAdmin, contactController.deleteContact);
module.exports = router;
