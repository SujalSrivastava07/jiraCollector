import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const token = jwt.sign({ userId: '123' }, 'super-secret-jwt-key-for-dev', { expiresIn: '7d' });

(async () => {
  const res = await fetch('http://localhost:8000/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const text = await res.text();
  console.log('Tickets:', text);
})();
