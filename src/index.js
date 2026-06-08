import express from 'express';

const app = express();
const PORT = 5000;

// Middleware (optional but useful)
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Hello, World!');

});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});