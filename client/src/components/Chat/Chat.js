import React, { useState, useEffect } from "react";
import { useLocation, Navigate } from "react-router-dom";
import queryString from 'query-string';
import io from "socket.io-client";

import TextContainer from '../textcontainer/TextContainer';
import Messages from '../messages/Messages';
import InfoBar from '../infoBar/InfoBar';
import Input from '../input/Input';

import './Chat.css';

// Set REACT_APP_SERVER_URL in a .env file for production; falls back to
// localhost:5000 (the default port used by server/index.js) for local dev.
const ENDPOINT = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

const Chat = () => {
  const location = useLocation();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const { name, room } = queryString.parse(location.search);

    const newSocket = io(ENDPOINT);
    setSocket(newSocket);

    setRoom(room);
    setName(name);

    newSocket.emit('join', { name, room }, (error) => {
      if (error) {
        alert(error);
      }
    });

    // Clean up the connection when the component unmounts so we don't
    // leak sockets or double-connect on re-render/navigation.
    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (!socket) return;

    socket.on('message', (message) => {
      setMessages((messages) => [...messages, message]);
    });

    socket.on('roomData', ({ users }) => {
      setUsers(users);
    });

    return () => {
      socket.off('message');
      socket.off('roomData');
    };
  }, [socket]);

  const sendMessage = (event) => {
    event.preventDefault();

    if (message && socket) {
      socket.emit('sendMessage', message, () => setMessage(''));
    }
  };

  // Guards against a crash (e.g. name.trim() on undefined inside Message.js)
  // when someone opens /chat directly without name/room query params.
  const { name: parsedName, room: parsedRoom } = queryString.parse(location.search);
  if (!parsedName || !parsedRoom) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="outerContainer">
      <div className="container">
        <InfoBar room={room} />
        <Messages messages={messages} name={name} />
        <Input message={message} setMessage={setMessage} sendMessage={sendMessage} />
      </div>
      <TextContainer users={users} />
    </div>
  );
};

export default Chat;
