//NOU: factorul de "lerp" independent de FPS.
//Un lerp cu 0.1 pe frame se aplica de 60 de ori pe secunda la 60hz, dar de
//144 de ori la 144hz, deci pe un monitor rapid tranzitia ar fi mult mai rapida.
//1 - e^(-k * delta) da acelasi rezultat dupa o secunda, oricate frame-uri ar fi.
//Pentru numere simple folosim direct THREE.MathUtils.damp(), care face acelasi
//calcul; functia asta e pentru vector.lerp() si color.lerp(), care cer doar factorul.
export function dampFactor(smoothing, delta) {
  return 1 - Math.exp(-smoothing * delta);
}
