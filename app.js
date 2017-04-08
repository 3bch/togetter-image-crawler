'use strict';

const fs = require('fs');
const path = require('path');

const axios = require('axios');
const Nightmare = require('nightmare');


function delay(wait) {
  return new Promise(resolve => setTimeout(resolve, wait));
}

function hasMoreButton(nightmare) {
  return nightmare.exists('.more_tweet_box a.btn');
}

function clickMoreButton(nightmare) {
  return nightmare
    .click('.more_tweet_box a.btn')
    .wait('.pagenation');
}

async function clickMoreButtonIfExist(nightmare) {
  const existMore = await hasMoreButton(nightmare);
  if (existMore) {
    await clickMoreButton(nightmare);
  }
}

async function getTogetterImageUrls(togetterUrl) {
  console.log(`fetching image urls... [${togetterUrl}]`);

  const nightmare = Nightmare();

  await nightmare.goto(togetterUrl);
  await clickMoreButtonIfExist(nightmare);

  const urls = await nightmare.evaluate(() => {
    const nodeList = document.querySelectorAll('.list_photo img');
    return Array.prototype.map.call(nodeList, (node) => node.src);
  });

  await nightmare.end();
  return urls;
}

async function getImages(urls, interval) {
  for(let i in urls) {
    const url = urls[i];
    const fileName = `images/${path.basename(url).split(':')[0]}`;
    console.log(`${+i+1}/${urls.length} ${fileName}`);
    const response = await axios.get(url, {responseType: 'stream'});
    response.data.pipe(fs.createWriteStream(fileName));
    await delay(interval);
  }
}

async function getTogetterImages(togetterUrl, interval) {
  const urls = await getTogetterImageUrls(togetterUrl);
  return await getImages(urls, interval);
}

async function getMaxPage(togetterUrl) {
  const nightmare = Nightmare();

  await nightmare.goto(togetterUrl);

  console.log(`fetching max page... [${togetterUrl}]`);
  await clickMoreButtonIfExist(nightmare);

  const pageLinks = await nightmare.evaluate(() => {
    const nodeList = document.querySelectorAll('.pagenation a');
    return Array.prototype.map.call(nodeList, (node) => node.textContent);
  });

  await nightmare.end();

  const pages = pageLinks
    .filter(link => /^[0-9]+$/.test(link))
    .map(Number);

  return Math.max.apply(null, pages);
}

async function main(togetterUrl, interval) {
  const maxPage = await getMaxPage(togetterUrl);
  for(let i = 0; i < maxPage; i++) {
    console.log(`page ${i+1}/${maxPage}`);
    await getTogetterImages(togetterUrl + '?page=' + (i+1), interval);
  }
}


const togetterUrl = process.argv[2];
let interval = process.argv[3] || 2000;
interval = Number(interval);

if(!togetterUrl.includes('http')) {
  console.log('URL invalid');
  console.log('node app.js [URL] [interval]');
  process.exit(1);
}


main(togetterUrl, interval).then(() => {
  console.log('finished!');
}).catch(e => {
  console.log(e);
  process.exit(1);
});
