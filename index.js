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

        //* ------------|| Api creation ||----------
        
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

