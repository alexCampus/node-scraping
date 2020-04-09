const cheerio = require('cheerio');
var db = require('./utils/connection');

const axios = require('axios');
const prefixUrl = 'https://www.cuisineaz.com/recettes/';
const recipe = 'poulet-au-citron-facon-tajine-de-cyril-lignac-110242.aspx';
// const siteUrl = 'galette-de-pommes-de-terre-salade-de-roquette-tomates-de-cyril-lignac-110240.aspx';
//const siteUrl = 'petits-pots-de-creme-a-la-vanille-de-cyril-lignac-110241.aspx';
// const siteUrl = 'penne-au-pesto-basilic-de-cyril-lignac-110238.aspx';
const siteUrl = prefixUrl + recipe;

let recetteName = '';
let img = '';
let categorie = '';
let insertedId = null;
let indexUstensileBegin = null;
const ingredients = new Set();
const etapes = new Set();
const textEtapes = new Set();
const fetchData = async() => {
    const result = await axios.get(siteUrl);
    return cheerio.load(result.data);
};

const getResults = async() => {
    const $ = await fetchData();

    recetteName = $('header h1').text();
    img = $('#ContentPlaceHolder_recipeImg').data('src');
    categorie = $('#compass ol li:nth-child(3) span').text();
    let payloadRecette = {
        name: recetteName,
        img: img,
        categorie: categorie
    };
    $('.recipe_ingredients li span').each((index, element) => {
        if ($(element).text() === 'Les ustensiles :' ||$(element).text() === ' Les ustensiles :' || $(element).text() === 'Les ustensiles : ' || $(element).text() === 'Ustensiles :'|| $(element).text() === 'Ustensiles : ') {
            indexUstensileBegin = index;
        }
        ingredients.add($(element).text().replace('•', '').trim());
    });
    $('.recipe_instructions p span').each((index, element) => {
        etapes.add($(element).text());
    });
    $('.recipe_instructions p').each((index, element) => {
        etapes.add($(element).children().text());
        textEtapes.add($(element).text().replace($(element).children().text(), ''));
    });
    if (indexUstensileBegin === null) {
        indexUstensileBegin = ingredients.size;
    }

    //insert in database
    insertedId = db.query('INSERT INTO recettes SET ?', payloadRecette, function(err, rows) {
        [...ingredients].slice(0, indexUstensileBegin).forEach(el => {
            let payloadIngredients = {
                content: el,
                recette_id: rows.insertId
            };
            db.query('INSERT INTO ingredients SET ?', payloadIngredients, function(err, rows) {

            });
        });
        [...ingredients].slice(indexUstensileBegin + 1).forEach(el => {
            let payloadUstensiles = {
                content: el,
                recette_id: rows.insertId
            };
            db.query('INSERT INTO ustensiles SET ?', payloadUstensiles, function(err, rows) {

            });
        });

        [...etapes].forEach((el, index) => {
            let payloadEtapes = {
                number: index + 1,
                content: [...textEtapes][index],
                recette_id: rows.insertId
            };
            db.query('INSERT INTO etapes SET ?', payloadEtapes, function(err, rows) {

            });
        });

    });

    return {
        etapes: [...etapes],
        textEtapes: [...textEtapes],
        ingredients: [...ingredients].slice(0, indexUstensileBegin),
        ustensiles: [...ingredients].slice(indexUstensileBegin + 1),
        recetteName,
        img
    };
};

module.exports = getResults;
