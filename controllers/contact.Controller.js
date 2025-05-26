const contactModel = require("../models/contactModel");

class Contact {
  async getAllContacts(req, res) {
    try {
      if (req.user.role === "admin") {
        const contacts = await contactModel.find({});
        if (contacts) {
          return res.json({ contacts });
        } else {
          return res.json({ error: "Contacts not found" });
        }
      } else {
        return res.json({
          error: "You are not authorized to access this page",
        });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to get contacts" });
    }
  }
  async getContactById(req, res) {
    const { id } = req.params;
    try {
      const contact = await contactModel.findById(id);
      if (contact) {
        return res.json({ contact });
      } else {
        return res.json({ error: "Contact not found" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to get contact" });
    }
  }
  async createContact(req, res) {
    const { name, email, message } = req.body;
    try {
      const contact = await contactModel.create({ name, email, message });
      if (contact) {
        return res.json({ success: "Contact created successfully" });
      } else {
        return res.json({ error: "Failed to create contact" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to create contact" });
    }
  }
  async deleteContact(req, res) {
    const { id } = req.params;
    try {
      const contact = await contactModel.findByIdAndDelete(id);
      if (contact) {
        return res.json({ success: "Contact deleted successfully" });
      } else {
        return res.json({ error: "Contact not found" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to delete contact" });
    }
  }
}

const contactController = new Contact();
module.exports = contactController;
