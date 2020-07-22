import React, { useState } from 'react';
import useInterval from '@use-it/interval';

const Pinger = ({ delay = 1000 }) => {
  const [count, setCount] = useState(0);

  useInterval(() => {
    alert(1);
  }, delay);

  return <h1>{count}</h1>;
};

export default Counter;
