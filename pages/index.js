import axios from 'axios';
import React from 'react';
import styles from './index.module.css';

const Auth = ({ setToken, setStaff }) => {
  const email = React.useRef();
  const password = React.useRef(); 
  const [error, setError] = React.useState(() => ''); 

  const login = async () => {
    let response = await axios.post('/user/login', { email: email.current.value, password: password.current.value }); 
    let { success, token, staff, code } = response.data; 
    if(success) {
      setStaff(staff) 
      setToken(token)
    } else {
      setError(code); 
    }
  }

  const register = async () => {
    let response = await axios.post('/user/register', { email: email.current.value, password: password.current.value }); 
    let { success, token, staff, code } = response.data; 
    console.log(response);
    if(success) {
      setStaff(staff) 
      setToken(token)
    } else {
      setError(code); 
    }
  }


  return <>
    <input ref={email} type="text" placeholder="enter email address" />
    <input ref={password} type="password" placeholder="enter password" />
    <button onClick={login}>Login</button>
    <button onClick={register}>Register</button>
    <p>{error}</p>
  </>
}


const Dashboard = ({ staff, token }) => {
  const containerAdoption = React.useRef();
  const containerRequests = React.useRef();
  const containerPending = React.useRef(); 
  const containerAdopted = React.useRef(); 

  const [forAdoption, setForAdoption] = React.useState(() => []);
  const [myRequests, setRequests] = React.useState(() => []);
  const [pendingRequests, setPendingRequests] = React.useState(() => []);
  const [adopted, setAdopted] = React.useState(() => []);

  const _name = React.useRef();
  const _type = React.useRef();
  const _desc = React.useRef();
  const _dob = React.useRef();
  const _picture = React.useRef(); 

  const doEverything = async () => {
    let _adoptions = await axios.get('/adoptions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if(_adoptions.data.data) {
      setForAdoption(_adoptions.data.data.filter(r => r.adopted_by == null)); 
      setAdopted(_adoptions.data.data.filter(r => r.adopted_by != null)); 
    }

    let _requests = await axios.get('/requests', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    setRequests(_requests.data.data)
    if(staff) { 
      let _pending =  await axios.get('/requests/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('hello?', _pending.data.data);

      setPendingRequests(_pending.data.data); 
    }
  };

  const createAnimal = async () => {
      var name = _name.current.value 
      var type = _type.current.value 
      var desc = _desc.current.value 
      var dob = _dob.current.value 
      var pic = _picture.current.value 
      if(pic.indexOf("http") == -1) return alert('use proper link for image'); 

    let _response = await axios.post('/animals', { name, type, dateOfBirth: dob, description: desc, pictures: [pic]}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if(_response.data.success) {
      doEverything(); 
    }
  }

  React.useEffect(async () => {
      doEverything(); 
  }, []); 

  return <>
    <h2>Animals for adoption</h2>
    <div ref={containerAdoption}>
      { forAdoption.map(animal => {
        return <ToAdopt key={animal.name+animal.type+animal.date_of_birth} animal={animal} token={token} doEverything={doEverything} />
      })}
      { forAdoption.length == 0 &&  <h4>No animals for adoption.</h4>}
    </div>
    { myRequests.length > 0 && <><h2>My Requests</h2>
    <div ref={containerRequests}>
    <div ref={containerPending}>
        { myRequests.map(pending => {
        return <PendingAdoption pending={pending} token={token} doEverything={doEverything} />
      })}
      </div>
    </div></> }
    { staff && <div>
      <h2>STAFF - Pending adoptions</h2>
      <div ref={containerPending}>
        { pendingRequests.map(pending => {
        return <PendingAdoption pending={pending} token={token}  doEverything={doEverything} />
      })}
      </div>
      <h2>STAFF - Adopted animals</h2>
      <div ref={containerAdopted}>
      { adopted.map(animal => {
        return <Adopted key={animal.name+animal.type+animal.date_of_birth} animal={animal}  doEverything={doEverything}/>
      })}
      </div>

      <h2>Create animal</h2>
      Name <input ref={_name} type="text" placeholder="name" /> <br/>
      Type <input ref={_type} type="text" placeholder="type" /> <br/>
      Description <input ref={_desc} type="text" placeholder="description" /> <br/>
      Date of Birth <input ref={_dob} type="date" /> <br/>
      Picture <input ref={_picture} type="text" placeholder="add link" /> <br />
      <button onClick={createAnimal}>create animal</button>
    </div> } 
  </>

}

const ToAdopt = ({ animal, token, doEverything }) => {
  const adopt = async () => {
    let response = await axios.post(`/animals/${animal._id}/adopt`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if(response.data.success) 
      doEverything(); 
  }
  return <div className={styles.item}>
    <div className={styles.part}>Name: {animal.name}</div>
    <div className={styles.part}>Type: {animal.type}</div>
    <div className={styles.part}>Description: {animal.description}</div>
    <div className={styles.part}>Date of Birth: {animal.date_of_birth}</div>
    <div className={styles.part}>
      {(animal.pictures || []).map(picture => {
        return <img key={animal.name + '-picture-' + picture} src={picture} className={styles.image}/>
      })}
    </div>
    <button onClick={adopt}>adopt</button>
  </div>
};

const Adopted = ({ animal }) => (
  <div className={styles.item}>
  <div className={styles.part}>Name: {animal.name}</div>
  <div className={styles.part}>Type: {animal.type}</div>
  <div className={styles.part}>Description: {animal.description}</div>
  <div className={styles.part}>Date of Birth: {animal.date_of_birth}</div>
  <div className={styles.part}>
    {(animal.pictures || []).map(picture => {
      console.log('picture:', picture);
      return <img key={animal.name + '-picture-' + picture} src={picture} className={styles.image}/>
    })}
  </div>
</div>
)

const PendingAdoption = ({ pending, token, doEverything }) => {
  const approve = async () => {
    let response = await axios.post(`/adoptions/${pending._id}/approve`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if(response.data.success) 
      doEverything(); 
  }

  const reject = async () => {
    let response = await axios.post(`/adoptions/${pending._id}/reject`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if(response.data.success) 
      doEverything(); 
  }

  return <div className={styles.item}>
    <div className={styles.part}>User: {pending.user}</div>
    <div className={styles.part}>Animal: {pending.animal}</div>
    <div className={styles.part}>Status: {pending.status}</div>
    <button onClick={approve}>Approve</button>
    <button onClick={reject}>Deny</button>
  </div>
};


const Index = () => {
  const [token, setToken] = React.useState(() => null); 
  const [staff, setStaff] = React.useState(() => false); 

  return <>
    { token == null && <Auth setToken={setToken} setStaff={setStaff} /> } 
    { token != null && <Dashboard staff={staff} token={token} /> }
  </>
}
export default Index;