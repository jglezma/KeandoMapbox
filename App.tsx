import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Animated,
} from 'react-native';
import Mapbox, {PointAnnotation} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';

Mapbox.setAccessToken(
  'Secret key',
);

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const generateRandomLocation = (latitude, longitude, maxDistance) => {
  const randomLatitude =
    latitude + (Math.random() * maxDistance * 2 - maxDistance);
  const randomLongitude =
    longitude + (Math.random() * maxDistance * 2 - maxDistance);
  return {
    latitude: randomLatitude,
    longitude: randomLongitude,
  };
};

const App = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCars, setShowCars] = useState(true);
  const [updateInterval, setUpdateInterval] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const vehiclePosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setUserLocation({latitude, longitude});
        generateRandomVehicles(latitude, longitude);
      },
      error => console.log(error.message),
      {enableHighAccuracy: true, timeout: 20000, maximumAge: 1000},
    );
    return () => {
      clearInterval(updateInterval);
    };
  }, []);

  const animateVehicleToUserLocation = () => {
    const duration = 3000;
    Animated.timing(vehiclePosition, {
      toValue: 1,
      duration,
      useNativeDriver: false,
      interpolate: [
        {
          inputRange: [0, 1],
          outputRange: [
            selectedVehicle ? selectedVehicle.coordinates[0] : [],
            userLocation.coordinates,
          ],
        },
      ],
    }).start(() => {
      setSelectedVehicle(null);
    });
  };

  const generateRandomVehicles = (latitude, longitude) => {
    const maxDistance = 0.002;
    const numVehicles = 4;
    const simulatedVehicles = [];
    while (simulatedVehicles.length < numVehicles) {
      const randomLocation = generateRandomLocation(
        latitude,
        longitude,
        maxDistance,
      );
      const distance = calculateDistance(
        latitude,
        longitude,
        randomLocation.latitude,
        randomLocation.longitude,
      );
      if (distance >= 100) {
        simulatedVehicles.push({
          id: simulatedVehicles.length + 1,
          latitude: randomLocation.latitude,
          longitude: randomLocation.longitude,
          distance: `${(distance / 1000).toFixed(1)}`,
          time: `${Math.floor(Math.random() * 60)}`,
        });
      }
    }
    setVehicles(simulatedVehicles);
  };

  const moveVehicleToUserLocation = vehicleId => {
    const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId);
    setSelectedVehicle(selectedVehicle);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prevState => !prevState);
  };

  const toggleVehicles = () => {
    setShowCars(prevState => !prevState);
  };

  const handleVehiclePress = event => {
    const feature = event.nativeEvent.payload;
    if (feature) {
      const vehicleId = feature.properties.vehicleId;
      const selectedVehicle = vehicles.find(
        vehicle => vehicle.id === vehicleId,
      );
      setSelectedVehicle(selectedVehicle);
      const route = [
        [selectedVehicle.longitude, selectedVehicle.latitude],
        [userLocation.longitude, userLocation.latitude],
      ];
      setRouteCoordinates(route);
      const interval = setInterval(() => {
        updateVehiclePosition();
      }, 1000);
      setUpdateInterval(interval);
    }
    getRoute();
  };

  const getRoute = async () => {
    if (selectedVehicle) {
      const {latitude, longitude} = selectedVehicle;
      const {latitude: userLatitude, longitude: userLongitude} = userLocation;
      try {
        const route = await obtenerRutaDesdeAPI(
          latitude,
          longitude,
          userLatitude,
          userLongitude,
        );
        if (route && route.length >= 2) {
          setRouteCoordinates(route);
          const interval = setInterval(() => {
            moveVehicleAlongRoute();
          }, 100);
          setUpdateInterval(interval);
        }
      } catch (error) {
        console.log('Error al obtener la ruta:', error);
      }
    }
  };

  const moveVehicleAlongRoute = () => {
    if (selectedVehicle && routeCoordinates.length >= 2) {
      const [nextLongitude, nextLatitude, ...remainingRoute] = routeCoordinates;
      setSelectedVehicle(prevVehicle => ({
        ...prevVehicle,
        latitude: nextLatitude,
        longitude: nextLongitude,
      }));
      setRouteCoordinates(remainingRoute);
      if (remainingRoute.length === 0) {
        clearInterval(updateInterval);
        setSelectedVehicle(null);
        setRouteCoordinates([]);
      }
    }
  };

  const updateVehiclePosition = () => {
    if (selectedVehicle) {
      const {latitude, longitude} = selectedVehicle;
      const {latitude: userLatitude, longitude: userLongitude} = userLocation;
      const newLatitude = latitude + (userLatitude - latitude) * 0.1;
      const newLongitude = longitude + (userLongitude - longitude) * 0.1;
      setSelectedVehicle(prevVehicle => ({
        ...prevVehicle,
        latitude: newLatitude,
        longitude: newLongitude,
      }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modeToggleContainer}>
        <Text style={styles.modeText}>Modo Claro</Text>
        <Switch
          value={isDarkMode}
          onValueChange={toggleDarkMode}
          thumbColor="#fff"
          trackColor={{true: '#5e5e5e', false: '#c4c4c4'}}
        />
        <Text style={styles.modeText}>Modo Oscuro</Text>
      </View>
      {userLocation && (
        <Mapbox.MapView
          styleURL={isDarkMode ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
          style={styles.map}
          centerCoordinate={[userLocation.longitude, userLocation.latitude]}
          zoomLevel={15}>
          <Mapbox.Camera
            zoomLevel={15}
            centerCoordinate={[userLocation.longitude, userLocation.latitude]}
            animationMode="flyTo"
            animationDuration={2000}
          />
          <Mapbox.UserLocation />
          <Mapbox.ShapeSource
            id="vehiclesSource"
            shape={{
              type: 'FeatureCollection',
              features: vehicles.map(vehicle => ({
                type: 'Feature',
                properties: {
                  vehicleId: vehicle.id,
                },
                geometry: {
                  type: 'Point',
                  coordinates: [vehicle.longitude, vehicle.latitude],
                },
              })),
            }}
            onPress={handleVehiclePress}>
            <Mapbox.SymbolLayer
              id="vehicleLayer"
              style={{iconImage: 'car-15', iconSize: 1}}
            />
          </Mapbox.ShapeSource>
          {selectedVehicle && (
            <Mapbox.ShapeSource
              id="routeSource"
              shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates,
                },
              }}>
              <Mapbox.LineLayer
                id="routeLayer"
                style={{lineColor: 'blue', lineWidth: 3}}
              />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>
      )}
      {selectedVehicle && (
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleId}>Vehículo {selectedVehicle.id}</Text>
          <Text>Distancia: {selectedVehicle.distance} km</Text>
          <Text>Tiempo estimado: {selectedVehicle.time} minutos</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingTop: 50,
  },
  modeText: {
    fontSize: 16,
    marginRight: 10,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    elevation: 2,
  },
  vehicleId: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
});

export default App;
