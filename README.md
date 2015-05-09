cycleDNDPlayground
=======

A simple playground to see how best to work with cycle when it comes to dealing with files, non-trivial objects and
drag and drop

----

to assemble the code:
```
  npm install
  webpack
```
At the time of writing the stream branch of cycle does not have a lib directory, so you need to build it:
```
  cd node_modules/cyclejs
  npm run compile-lib
```