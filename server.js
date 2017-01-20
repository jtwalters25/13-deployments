'use strict';

const pg = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
const requestProxy = require('express-request-proxy'); // REVIEW: We've added a new package here to our requirements, as well as in the package.json
const app = express();
const PORT = process.env.PORT || 3000;
const conString = process.env.DATABASE_URL || 'postgres://localhost:5432';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('./public'));


// NOTE: Routes for requesting HTML resources
app.get('/', (request, response) => response.sendFile('index.html', {root: './public'}));
app.get('/new', (request, response) => response.sendFile('new.html', {root: './public'}));


// REVIEW: This is a new route that will utilize our middle man proxy.
app.get('/github/*', proxyGitHub);

// REVIEW: This is a new proxy method which acts as a 'middle man' (middleware) for our request.
function proxyGitHub(request, response) {
  console.log('Routing GitHub request for', request.params[0]);
  (requestProxy({
    url: `https://api.github.com/${request.params[0]}`,
    headers: {Authorization: `token ${process.env.GITHUB_TOKEN}`}
  }))(request, response);
}


// NOTE: Routes for making API calls to enact CRUD Operations on our database
app.get('/articles/all', (request, response) => {
  let client = new pg.Client(conString);

  client.connect(err => {
    if (err) console.error(err);
    client.query(
      `SELECT * FROM articles
      INNER JOIN authors
      ON articles.author_id=authors.author_id;`,
      (err, result) => {
        if (err) console.error(err);
        response.send(result);
        client.end();
      }
    );
  })
});

app.post('/articles/insert', (request, response) => {
  let client = new pg.Client(conString);

  client.query(
    'INSERT INTO authors(author, "authorUrl") VALUES($1, $2) ON CONFLICT DO NOTHING',
    [request.body.author, request.body.authorUrl],
    err => {
      if (err) console.error(err);
      queryTwo();
    }
  );

  function queryTwo() {
    client.query(
      `SELECT author_id FROM authors WHERE author=$1`,
      [request.body.author],
      (err, result) => {
        if (err) console.error(err);
        queryThree(result.rows[0].author_id);
      }
    );
  }

  function queryThree(author_id) {
    client.query(
      `INSERT INTO
      articles(author_id, title, category, "publishedOn", body)
      VALUES ($1, $2, $3, $4, $5);`,
      [
        author_id,
        request.body.title,
        request.body.category,
        request.body.publishedOn,
        request.body.body
      ]
    );
  }

  client.connect();
  response.send('insert complete');
});

app.put('/articles/update', (request, response) => {
  let client = new pg.Client(conString);

  client.query(
    `SELECT author_id FROM authors WHERE author=$1`,
    [request.body.author],
    (err, result) => {
      if (err) console.error(err);
      queryTwo(result.rows[0].author_id);
      queryThree(result.rows[0].author_id);
    }
  );

  function queryTwo(author_id) {
    client.query(
      `UPDATE authors
      SET author=$1, "authorUrl"=$2
      WHERE author_id=$3;`,
      [request.author, request.authorUrl, author_id]
    );
  }

  function queryThree(author_id) {
    client.query(
      `UPDATE articles
      SET author_id=$1, title=$2, category=$3, "publishedOn"=$4, body=$5
      WHERE article_id=$6;`,
      [
        author_id,
        request.body.title,
        request.body.category,
        request.body.publishedOn,
        request.body.body,
        request.body.article_id
      ]
    );
  }

  client.connect();
  response.send('insert complete');
});

app.delete('/articles/delete', (request, response) => {
  let client = new pg.Client(conString);

  client.connect(err => {
    if (err) console.error(err);

    client.query(
      `DELETE FROM articles WHERE article_id=${request.body.article_id};`,
      err => {
        if (err) console.error(err);
        client.end();
      }
    );
  });
  response.send('Delete complete');
});

app.delete('/articles/truncate', (request, response) => {
  let client = new pg.Client(conString);

  client.connect(err => {
    if (err) console.error(err);

    client.query(
      'DELETE FROM articles;',
      err => {
        if (err) console.error(err);
        client.end();
      }
    );
  });
  response.send('Truncate complete');
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}!`));
