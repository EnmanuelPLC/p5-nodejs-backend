let arr = [1, 2, 3, 4, 5];
let obj = {};

arr.forEach((val, i) => {
  obj[val] = val;
});

console.log(obj);

Object.keys(obj).map((year, i) => {
  console.log(year);
});