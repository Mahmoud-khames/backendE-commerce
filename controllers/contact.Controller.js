const ContactService = require('../services/contact.service');

class Contact {
  async getAllContacts(req, res) {
    try {
      if (req.user.role === "admin") {
        const { result } = await ContactService.GetContacts({ perPage: 9999, page: 1 });
        return res.json({ contacts: result.data });
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
      const contact = await ContactService.GetOneContact(id);
      return res.json({ contact });
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to get contact" });
    }
  }
  async createContact(req, res) {
    const { name, email, message } = req.body;
    try {
      await ContactService.AddContact({ name, email, message });
      return res.json({ success: 'Contact created successfully' });
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to create contact" });
    }
  }
  async deleteContact(req, res) {
    const { id } = req.params;
    try {
      await ContactService.DeleteContact(id);
      return res.json({ success: 'Contact deleted successfully' });
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to delete contact" });
    }
  }
}

const contactController = new Contact();
module.exports = contactController;
