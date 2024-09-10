import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { parse } from "papaparse";

function ThreeScene() {
  const mountRef = useRef(null);
  const [csvData, setCsvData] = useState(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const orbitControlsRef = useRef(null);
  const transformControlsRef = useRef(null);
  const cubesRef = useRef([]);

  useEffect(() => {
    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer();
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Create a plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    // adding text

    scene.add(plane);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Set up camera position
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Set up orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControlsRef.current = orbitControls;
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.25;
    orbitControls.enableZoom = true;

    // Set up transform controls
    const transformControls = new TransformControls(
      camera,
      renderer.domElement
    );
    transformControlsRef.current = transformControls;
    transformControls.addEventListener("dragging-changed", (event) => {
      orbitControls.enabled = !event.value;
    });
    scene.add(transformControls);

    // Function to create cubes based on CSV data
    const createCubes = (data) => {
      // Remove existing cubes
      cubesRef.current.forEach((cube) => scene.remove(cube));
      cubesRef.current = [];

      const spacing = 0.5;
      const planeSize = 100;
      const margin = 2;

      let xOffset = -planeSize / 2 + margin;
      let zOffset = -planeSize / 2 + margin;
      let rowMaxHeight = 0;

      data.forEach((row) => {
        const Count = parseFloat(row.Count) || 0;
        const area = parseFloat(row["Area per unit"]) || 0;
        const Width = parseFloat(row.Width) || 0;
        const color = row["Category colour"] || "#FFFFFF";
        const textString = row.Space;

        const size = Math.sqrt(area);
        const height = Width;
        const cubeGeometry = new THREE.BoxGeometry(size, height, size);
        const cubeMaterial = new THREE.MeshPhongMaterial({ color: color });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        if (xOffset + size > planeSize / 2 - margin) {
          xOffset = -planeSize / 2 + margin;
          zOffset += rowMaxHeight + spacing;
          rowMaxHeight = 0;
        }

        if (zOffset + size > planeSize / 2 - margin) {
          console.warn("Not enough space on the plane for all cubes");
          return;
        }

        const xPos = xOffset + size / 2;
        const zPos = zOffset + size / 2;
        cube.position.set(xPos, height / 2, zPos);
        let canvas1 = document.createElement("canvas");
        let context1 = canvas1.getContext("2d");
        context1.font = "Bold 15px Arial";
        context1.fillStyle = "rgba(255,0,0,1)";
        context1.fillText(textString, 0, 60);

        // canvas contents will be used for a texture
        let texture1 = new THREE.Texture(canvas1);
        texture1.needsUpdate = true;

        let material1 = new THREE.MeshBasicMaterial({
          map: texture1,
          side: THREE.DoubleSide,
        });
        material1.transparent = true;

        let mesh1 = new THREE.Mesh(new THREE.PlaneGeometry(50, 10), material1);
        mesh1.position.set(25, 5, -5);
        mesh1.rotation.x = 0;
        cube.add(mesh1);
        cube.updateMatrix();

        scene.add(cube);
        cubesRef.current.push(cube);

        xOffset += size + spacing;
        rowMaxHeight = Math.max(rowMaxHeight, size);
      });
    };

    // Function to handle cube click
    const handleCubeClick = (clickedCube) => {
      transformControls.attach(clickedCube);
    };

    // Raycaster for object selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Event listener for mouse click
    const onMouseClick = (event) => {
      event.preventDefault();

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cubesRef.current, false);

      if (intersects.length > 0) {
        const clickedCube = intersects[0].object;
        handleCubeClick(clickedCube);
      } else {
        transformControls.detach();
      }
    };

    renderer.domElement.addEventListener("click", onMouseClick);

    // Animation function
    const animate = () => {
      requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };

    // Start animation
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Create cubes if CSV data is available
    if (csvData) {
      createCubes(csvData);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onMouseClick);
      mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [csvData]); // Re-run effect when csvData changes

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      parse(file, {
        complete: (results) => {
          setCsvData(results.data.slice(1)); // Exclude header row
        },
        header: true,
      });
    }
  };

  return (
    <>
      <div className="w-full h-[5vh]">
        <input type="file" accept=".csv" onChange={handleFileUpload} />
      </div>
      <div ref={mountRef} style={{ width: "100%", height: "95vh" }} />
    </>
  );
}

function App() {
  return (
    <div className="overflow-hidden">
      <ThreeScene />
    </div>
  );
}

export default App;
