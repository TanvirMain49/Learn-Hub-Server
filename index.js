require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middle ware
app.use(cors())
app.use(express.json())

// DB_PASS=4GDmDDD9qcPChmXh
// DB_USER=LearnHub


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kriop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        //*-----------|| All Api collection ||----------
        const sessionCollection = client.db("LearnHub").collection('sessions');
        const materialCollection = client.db("LearnHub").collection('materials');

        //* ------------|| Api creation ||----------

        //* ------------|| Session Api ||----------
        
        //! || Session post method ||
        app.post('/session', async(req, res)=>{
            const session = req.body;
            const result = await sessionCollection.insertOne(session);
            res.send(result);
        })
 
        //! || Session get method ||
        app.get('/session', async(req, res)=>{
            const result = await sessionCollection.find().toArray();
            res.send(result)
        }) 

        //! || Session get by id method ||
        app.get('/session/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await sessionCollection.findOne(query);
            res.send(result)
        })

        //! || Session get by email method ||
        app.get('/personalSession/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {tutorEmail: email};
            const result = await sessionCollection.find(query).toArray();
            res.send(result)
        })
        
        //* ------------|| Material Api ||----------

         //! || material post method ||
         app.post('/materials', async(req, res)=>{
            const material = req.body;
            const email = req.query.email;
            const id = req.query.id;
            const query = {email: email, sessionId: id};
            const existing = await materialCollection.findOne(query);
            if(existing){
                return res.status(400).send({message: "Card Already exist"})
            }
            const result = await materialCollection.insertOne(material);
            res.send(result);
         })

         //! || material get by id method ||
        //  app.get('/materials/:id', async(req, res)=>{
        //     const id = req.params.id;
        //     const query = {_id: new ObjectId(id)};
        //     console.log(query);
        //     const result = await materialCollection.findOne(query);
        //     console.log(result);
        //     res.send(result);
        //  })

        //  //! || material get by email and id method ||
        //  app.get('/materialItem/:email', async(req, res)=>{
        //     const email = req.params.email;
        //     const id = req.query.id;
        //     const query = {email: email, sessionId: id };
        //     const result = await materialCollection.findOne(query);
        //     res.send(result);
        //  })

         //! || material patch id method ||
         app.patch('/materials/:id', async(req, res)=>{
            const id = req.params.id;
            const material = req.body;
            const filter = {sessionId: id};
            const updateDoc = {
                $set:{
                    doc: material.doc,
                    image: material.image
                }
            }
            const result = await materialCollection.updateOne(filter, updateDoc);
            res.send(result);
         })

         //! || material delete method ||
         app.delete('/materials/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id : new ObjectId(id)};
            const result = await sessionCollection.deleteOne(query);
            res.send(result)
         })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Go to Study please!!!!')
})

app.listen(port, () => {
    console.log(`server is running at port: ${port}`);
})

