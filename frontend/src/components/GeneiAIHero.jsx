import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import logo from '../assets/logo.jpg';

function useVideoFadeLoop(videoRef) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId;
    let fadingOut = false;
    
    // Config
    const fadeDuration = 0.5; // seconds
    const duration = video.duration || 10; // fallback if metadata not loaded

    const updateOpacity = () => {
      const currentTime = video.currentTime;
      const vidDuration = video.duration || duration;
      
      if (currentTime < fadeDuration) {
        // Fade in
        video.style.opacity = currentTime / fadeDuration;
        fadingOut = false;
      } else if (currentTime > vidDuration - fadeDuration) {
        // Fade out
        video.style.opacity = (vidDuration - currentTime) / fadeDuration;
        fadingOut = true;
      } else {
        video.style.opacity = 1;
        fadingOut = false;
      }
      
      rafId = requestAnimationFrame(updateOpacity);
    };

    const onPlay = () => {
      rafId = requestAnimationFrame(updateOpacity);
    };

    const onEnded = () => {
      cancelAnimationFrame(rafId);
      video.style.opacity = 0;
      setTimeout(() => {
        video.play().catch(e => console.log('Autoplay prevented', e));
      }, 100);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('ended', onEnded);
    
    // Start initial play
    video.play().catch(e => console.log('Autoplay prevented', e));

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('ended', onEnded);
    };
  }, []);
}

const BackgroundVideo = () => {
  const videoRef = useRef(null);
  useVideoFadeLoop(videoRef);

  return (
    <video
      ref={videoRef}
      src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4"
      className="absolute inset-0 w-full h-full object-cover z-0"
      muted
      playsInline
      style={{ opacity: 0, transition: 'none' }}
    />
  );
};

const Navbar = ({ onSignUp }) => {
  return (
    <div className="w-full flex flex-col z-20 relative">
      <div className="py-5 px-8 flex flex-row justify-between items-center w-full">
        {/* Left */}
        <div className="flex items-center">
          <img src={logo} alt="GeneiAI Logo" className="h-[32px] object-contain rounded-md" />
        </div>
        
        {/* Center removed per user request */}

        {/* Right */}
        <div className="flex items-center">
          <button onClick={onSignUp} className="heroSecondary rounded-full px-4 py-2 text-sm font-medium">
            Sign Up
          </button>
        </div>
      </div>
      
      {/* Divider */}
      <div className="w-full h-[1px] mt-[3px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
    </div>
  );
};

const HeroContent = () => {
  return (
    <div className="flex-1 flex items-center justify-center relative w-full overflow-visible z-20">
      {/* Blurred Overlay Shape */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[984px] h-[527px] opacity-90 bg-gray-950 blur-[82px] pointer-events-none -z-10" />
      
      {/* Content */}
      <div className="flex flex-col items-center text-center">
        <h1 
          className="text-[220px] font-normal leading-[1.02] tracking-[-0.024em] m-0"
          style={{ fontFamily: "'General Sans', sans-serif" }}
        >
          <span className="text-foreground">Genei</span>
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to left, #6366f1, #a855f7, #fcd34d)' }}>
            AI
          </span>
        </h1>
        
        <p className="text-[hsl(var(--hero-sub))] text-lg leading-8 max-w-md mt-[9px] opacity-80 m-0">
          The future of engineering is HUMAN+AI
        </p>
        
      </div>
    </div>
  );
};

const LogoMarquee = () => {
  const logos = ['Vortex', 'Nimbus', 'Prysma', 'Cirrus', 'Kynder', 'Halcyn'];
  
  return (
    <div className="w-full pb-10 z-20 relative overflow-hidden">
      <div className="max-w-5xl mx-auto flex flex-row items-center gap-12">
        {/* Left: Static text */}
        <div className="text-foreground/50 text-sm whitespace-nowrap leading-snug shrink-0">
          Relied on by brands<br />across the globe
        </div>
        
        {/* Right: Marquee */}
        <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
          <div className="flex flex-row w-max animate-marquee gap-16 pr-16">
            {/* Double the logos to create infinite loop effect */}
            {[...logos, ...logos].map((logo, idx) => (
              <div key={idx} className="flex flex-row items-center gap-3">
                <div className="liquid-glass w-[24px] h-[24px] rounded-lg flex items-center justify-center font-bold text-foreground text-xs shadow-sm">
                  {logo.charAt(0)}
                </div>
                <span className="text-base font-semibold text-foreground tracking-wide">
                  {logo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GeneiAIHero({ onSignUp }) {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative w-full bg-background">
      <BackgroundVideo />
      
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        <Navbar onSignUp={onSignUp} />
        <HeroContent />
      </div>
    </div>
  );
}
