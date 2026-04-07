import './App.css';
import landingImage from './assets/landing-image.png';

function App() {
  return (
    <div className="app-container">
      {/* Background decorations for dynamic feel */}
      <div className="bg-decoration dec-1"></div>
      <div className="bg-decoration dec-2"></div>
      <svg className="bg-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="30" y2="100" stroke="#2563eb" strokeWidth="0.1" opacity="0.2" />
        <line x1="100" y1="20" x2="40" y2="100" stroke="#2563eb" strokeWidth="0.1" opacity="0.2" />
        <line x1="50" y1="0" x2="100" y2="80" stroke="#2563eb" strokeWidth="0.1" opacity="0.2" />
      </svg>
      
      <main className="content-wrapper">
        <div className="image-container">
          <img src={landingImage} alt="Nutrition Plate Illustration" className="hero-image" />
        </div>
        
        <div className="text-section">
          <h1 className="title">
            <span className="title-row">Makan Cerdas,</span>
            <span className="title-row">Hidup Berkualitas</span>
          </h1>
          
          <p className="subtitle">
            Mengatur pola makan bukan soal diet ketat, tapi tentang konsistensi dan keseimbangan.
          </p>
        </div>
        
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => console.log('Login clicked')}>
            Login
          </button>
          <button className="btn btn-secondary" onClick={() => console.log('Register clicked')}>
            Register
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
