import React, { useState, useEffect } from "react";
import lgnIllustartion1 from "../../Assets/Logos/11024-removebg-preview.png";
import lgnIllustartion2 from "../../Assets/Logos/2212.i121.022.P.m005.c33.isometric_water_purification_technology_set-removebg-preview.png";
import lgnIllustartion3 from "../../Assets/Logos/4odv_dpna_211112-removebg-preview.png";

const slides = [
  {
    title: "Smart Water Management System",
    description:
      "Monitor and control water distribution with real-time analytics, automated flow tracking, tank monitoring, and intelligent resource management for efficient operations.",
    image: lgnIllustartion1,
  },
  {
    title: "Advanced ESR Storage Monitoring",
    description:
      "Track Elevated Storage Reservoir (ESR) levels, water capacity, inflow, outflow, and leakage detection with a centralized smart dashboard for better storage management.",
    image: lgnIllustartion2,
  },
  {
    title: "Real-Time Data & Performance Insights",
    description:
      "Access live reports, consumption analytics, pump status, pressure monitoring, and operational insights to ensure smooth and reliable water supply management.",
    image: lgnIllustartion3,
  },
];

export default function LeftSection({ logo }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(timer);
  }, []);

  const { title, description, image } = slides[currentSlide];

  return (
    <div className="flex flex-col justify-center items-center bg-white p-10 transition-all duration-500">
      <div className="mb-6">
        <img src={logo} alt="logo" className="w-auto h-24 mb-3" />
      </div>
      <img src={image} alt="Illustration" className="w-auto h-72 mb-6" />
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 tracking-wide">
        {title}
      </h2>
      <p className="text-gray-600 tracking-wide text-center max-w-md">
        {description}
      </p>
      <div className="flex mt-4 space-x-2">
        {slides.map((_, index) => (
          <span
            key={index}
            className={`h-2 ${
              index === currentSlide ? "w-8 bg-blue-600" : "w-2 bg-gray-400"
            } rounded-full transition-all duration-300`}
          ></span>
        ))}
      </div>
    </div>
  );
}
