fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json')
  .then(r => r.json())
  .then(d => console.log(d));
