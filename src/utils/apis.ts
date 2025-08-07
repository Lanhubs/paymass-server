import axios from 'axios';

const blockradar = axios.create({
  baseURL: process.env.BLOCKRADAR_BASE_URL,
  headers: {
    'x-api-key': process.env.BLOCKRADAR_API_KEY??"",
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

export default blockradar;