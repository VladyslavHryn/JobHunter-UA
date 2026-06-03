import axios from 'axios';
import * as cheerio from 'cheerio';

axios.get('https://www.work.ua/jobs-developer/').then(res => {
  const $ = cheerio.load(res.data);
  const card = $('.card').has('h2').first();
  console.log(card.html());
});
