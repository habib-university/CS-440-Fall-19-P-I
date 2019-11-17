function map_point(p, q, a, b, x)
{
  if ( p.length != q.length || x.length != q.length || a.length != b.length) {
      throw "vector dimension mismatch";
  }

  for (var i = 0; i < p.length; i++){
      // check to ensure that we dont end up with an undefined alpha
      if (p[i] !== q[i]){
        var alpha = (x[i] - p[i])/(q[i] - p[i]);
        return mix(a, b, alpha);
      }
  }

  throw "p and q are the same point";
}