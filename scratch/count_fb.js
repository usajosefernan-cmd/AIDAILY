fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json')
  .then(r => r.json())
  .then(d => console.log(Object.keys(d).length))
  .catch(err => console.error(err));
