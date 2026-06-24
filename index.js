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

    // (POST)
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

    // ২.  (GET)
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

    // ৪. (PUT)
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

    //  (DELETE)
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
