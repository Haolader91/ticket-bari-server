const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 8080;

require("dotenv").config();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// mongodb code
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("ticketBari");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    const transactionsCollection = db.collection("transactions"); // 🆕 নতুন কালেকশন: ট্রানজেকশন হিস্ট্রির জন্য

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: নতুন টিকিট ডাটাবেজে যোগ করার API (POST)
    // =========================================================================
    app.post("/api/tickets", async (req, res) => {
      try {
        const {
          title,
          from,
          to,
          price,
          quantity,
          departureDateTime,
          image,
          vendorEmail,
        } = req.body;

        const newTicket = {
          title,
          from,
          to,
          price: parseFloat(price),
          quantity: parseInt(quantity),
          departureDateTime,
          image,
          vendorEmail,
          status: "pending",
          isAdvertised: false,
          createdAt: new Date(),
        };

        const result = await ticketsCollection.insertOne(newTicket);
        res.status(201).send({
          success: true,
          message: "Ticket added successfully!",
          id: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: লগইন থাকা ভেন্ডরের নিজস্ব টিকিটগুলো দেখার API (GET)
    // =========================================================================
    app.get("/api/vendor/tickets", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "Vendor email is required" });
        }

        const query = { vendorEmail: email };
        const tickets = await ticketsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: টিকিট এডিট/আপডেট করার API (PUT)
    // =========================================================================
    app.put("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedData = req.body;

        const updateDoc = {
          $set: {
            title: updatedData.title,
            from: updatedData.from,
            to: updatedData.to,
            price: parseFloat(updatedData.price),
            quantity: parseInt(updatedData.quantity),
            departureDateTime: updatedData.departureDateTime,
            image: updatedData.image,
            status: "pending",
          },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: "Ticket updated successfully in database!",
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: টিকিট ডিলিট করার API (DELETE)
    // =========================================================================
    app.delete("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await ticketsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Ticket deleted successfully from database",
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: এডমিন কর্তৃক APPROVED সব টিকিট হোম/লিস্টিং পেজে দেখার API (GET)
    // =========================================================================
    app.get("/api/tickets", async (req, res) => {
      try {
        const query = { status: "approved" };
        const tickets = await ticketsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: টিকিট ডিটেইলস পেজে সিঙ্গেল টিকিটের ডাটা লোড করার API (GET)
    // =========================================================================
    app.get("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const ticket = await ticketsCollection.findOne(query);

        if (ticket) {
          res.send({ success: true, data: ticket });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 👑 এডমিন প্যানেল: পেন্ডিং বা সব ভেন্ডরের টিকিট লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/admin/tickets", async (req, res) => {
      try {
        const tickets = await ticketsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 👑 এডমিন প্যানেল: ভেন্ডরের টিকিট Approve বা Reject করার API (POST)
    // =========================================================================
    app.post("/api/admin/tickets/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ success: false, error: "Invalid status" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: `Ticket status updated to ${status}`,
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: 'Book Now' ক্লিক করলে নতুন বুকিং ক্রিয়েট এবং মেইন স্টক থেকে সিট মাইনাস করার API (POST)
    // =========================================================================
    app.post("/api/bookings", async (req, res) => {
      try {
        const { ticketId, userEmail, user, bookingQuantity, totalPrice } =
          req.body;

        const ticket = await ticketsCollection.findOne({
          _id: new ObjectId(ticketId),
        });
        if (!ticket) {
          return res
            .status(404)
            .send({ success: false, error: "Ticket not found!" });
        }

        if (ticket.quantity < parseInt(bookingQuantity)) {
          return res
            .status(400)
            .send({ success: false, error: "Not enough available seats!" });
        }

        const newBooking = {
          ticketId,
          ticketTitle: ticket.title,
          ticketImage: ticket.image,
          from: ticket.from,
          to: ticket.to,
          departureDate: ticket.departureDateTime,
          vendorEmail: ticket.vendorEmail,
          userEmail,
          user,
          bookingQuantity: parseInt(bookingQuantity),
          totalPrice: parseFloat(totalPrice),
          status: "pending",
          createdAt: new Date(),
        };

        const bookingResult = await bookingsCollection.insertOne(newBooking);

        await ticketsCollection.updateOne(
          { _id: new ObjectId(ticketId) },
          { $inc: { quantity: -parseInt(bookingQuantity) } },
        );

        res.status(201).send({
          success: true,
          message: "Booking requested and seat count reduced!",
          bookingId: bookingResult.insertedId,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: লগইন থাকা ইউজারের নিজস্ব বুকিং লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/user/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "User email is required" });
        }

        // ডাটাবেজ থেকে ইউজার অনুযায়ী বুকিং ডাটা নিয়ে আসা
        const bookings = await bookingsCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: bookings });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: ভেন্ডরের নিজস্ব টিকিটের বিপরীতে আসা বুকিং রিকোয়েস্ট লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/vendor/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "Vendor email is required" });
        }

        const bookings = await bookingsCollection
          .find({ vendorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: bookings });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: ইউজারের বুকিং রিকোয়েস্ট Accept বা Reject করার API (POST)
    // (রিজেক্ট করলে টিকিট পুনরায় মেইন স্টকে প্লাস/ফেরত হবে)
    // =========================================================================
    app.post("/api/vendor/bookings/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["accepted", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ success: false, error: "Invalid status" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!booking) {
          return res
            .status(404)
            .send({ success: false, error: "Booking request not found" });
        }

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } },
        );

        if (status === "rejected") {
          await ticketsCollection.updateOne(
            { _id: new ObjectId(booking.ticketId) },
            { $inc: { quantity: booking.bookingQuantity } },
          );
        }

        res.send({
          success: true,
          message: `Booking request has been ${status}`,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================

    // =========================================================================

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
