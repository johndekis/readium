var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");
var favicon = require('serve-favicon');

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI); 
 

var request = require("request");
var cheerio = require("cheerio");
var db = require("./models");
var path = require("path");

var PORT = process.env.PORT || 8085;


// Initialize Express
var app = express();
var request = require('request');
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//app.use(favicon(__dirname + '/public/images/favicon.ico'));
console.log(`
dirname: ${__dirname}
 `);
app.use(favicon(path.join(__dirname,'public','images','favicon.ico')));


//set up handlebars
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");


// Routes
//==============================================================================

// Home page 

app.get("/", function(req, res){
  db.Article.find({})
  .populate("comment")
  .then(function(dbArticles) {
    var hbsObject = {
      articles: dbArticles
    }
    res.render("index", hbsObject);
  })
  .catch(function(err) {    
    res.json(err);
  });
});


// Saved Articles page 
app.get("/saved", function(req, res){
  db.Article.find({saved: true})
  .populate("comment")
  .then(function(dbArticles) {
    var hbsObject = {
      articles: dbArticles
    }
    console.log(hbsObject);
    res.render("saved", hbsObject);
  })
  .catch(function(err) {
    res.json(err);
  });
});


// A GET route for scraping latest tech article headlines from the medium website
app.get("/scrape-new", function(req, res) {           
  db.Article.find({}).then(savedArticles => {

    let savedTitles = savedArticles.map(article => article.title);    

    request("https://medium.com/topic/technology", function(error, response, html) {

      // Latest tech articles
      var $ = cheerio.load(html);  
      $("section.fg").each(function(i, element) {             

        var newArticle = {};
        // div section div div div h3 a
      
        newArticle.title = $(this).children("div").children("section").children("div").children("div").children("div").children("h3").children("a").text();
        newArticle.link = $(this).children("div").children("section").children("div").children("div").children("div").children("h3").children("a").attr("href");
        newArticle.author =$(this).children("div").children("section").children("div").children("div.fu").children("div").children("div").children("div").children("span").children("a").text();
        //console.log(`title: ${newArticle.title}   author: ${newArticle.author}`);
        
        if(!savedTitles.includes(newArticle.title)){
          var entry = new db.Article(newArticle);
          //console.log(entry);
        } else {
          return;
        }   

        entry.save().then(function(data){
          console.log(data);
        })          
          .catch(function(err) {          
          return res.json(err);
        }); //catch

      });  // cheerio loop      
    
      res.redirect("/");
    });// request()
  });// .then()     
});// app.get()


// A GET route for scraping popular tech article headlines from the medium website
app.get("/scrape-popular", function(req, res) {           
  db.Article.find({}).then(savedArticles => {

    let savedTitles = savedArticles.map(article => article.title);    

    request("https://medium.com/topic/technology", function(error, response, html) {

      // Latest tech articles
      var $ = cheerio.load(html);  
      $("article.im").each(function(i, element) {             

        var newArticle = {};
        // div section div div div h3 a
      
        newArticle.title = $(this).children("div").children("div").children("a").children("div").children("h4").text();
        newArticle.link = $(this).children("div").children("div").children("a").attr("href");
        //console.log(`title: ${newArticle.title}`);
        
        if(!savedTitles.includes(newArticle.title)){
          var entry = new db.Article(newArticle);
          //console.log(entry);
        } else {
          return;
        }   

        entry.save().then(function(data){
          console.log(data);
        })          
          .catch(function(err) {          
          return res.json(err);
        }); //catch

      });  // cheerio loop      
    
      res.redirect("/");
    });// request()
  });// .then()     
});// app.get()





///
///  ================ API endpoints ===================
///

app.get("/articles", function(req, res){
  db.Article.find({})
  .populate("comment")
  .then(function(dball){
    res.json(dball);
  })
});
  
  // Route for grabbing a specific Article by id, populate it with it's save
app.get("/articles/:id", function(req, res) {
    db.Article.findOne({ _id: req.params.id })
      .populate("comment")
      .then(function(dbArticle) {
        console.log(dbArticle.comment);
        res.json(dbArticle);
      })
      .catch(function(err) {
        res.json(err);
      });
}); 


//================      Save / Update Comment Route    ======================
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Comment.create(req.body)
    .then(function(dbComment) {
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { comment:  dbComment._id}, { new: true });
    })
    .then(function(dbArticle) {
      // res.json(dbArticle);
      db.Comment.find({ _id: dbArticle.comment})
      .then(dbComment => {
        console.log("dbComment: " + dbComment);
      })
      //res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

// Save an article
app.put("/articles/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: true})  
  .then(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }    
  });
});

// Delete an article
app.put("/articles/delete/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: false}) 
  .then(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      console.log(doc);
      // Or send the document to the browser
      res.redirect("/");
    }
  });
});

//================      Delete Comment Route    ======================
app.put("/articles/delete_comment/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  db.Comment.deleteOne({ _id: req.params.id }, function(err, comment) {
    if (err) {
      console.log(err);
    } else {

      if(comment){
        console.log(comment);
      } else {
        console.log(`No comment..`);
      }
      
    }
  }); 
});

//================      Delete all unsaved articles    ======================
app.get("/clear", function(req, res) {
  // Use the article id to find and update its saved boolean
  db.Article.deleteMany({ "saved": "false"}, function(err, obj) {
    if(err){
        console.log(err);
    }
    return obj;
  }) 
  .then(function(res) {
    // Log any errors
    console.log(res);   
  }).catch(e => {
    console.log(e);
  });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
