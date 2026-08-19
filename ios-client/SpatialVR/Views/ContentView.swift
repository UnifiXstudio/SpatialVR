// ios-client/SpatialVR/Views/ContentView.swift
import SwiftUI

enum AppMode {
    case connection
    case arPassthrough
    case vrHeadset
}

struct ContentView: View {
    @StateObject private var streamClient = StreamClient()
    @State private var currentMode: AppMode = .connection
    @State private var serverIP: String = "172.20.10.2"
    
    // Spatial Settings
    @State private var screenDistance: Float = 2.0
    @State private var screenScale: Float = 1.5
    @State private var screenCurvature: Float = 25.0
    @State private var ipdMm: Float = 64.0
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            switch currentMode {
            case .connection:
                connectionView
            case .arPassthrough:
                ZStack {
                    ARPassthroughContainer(
                        streamClient: streamClient,
                        screenDistance: $screenDistance,
                        screenScale: $screenScale,
                        screenCurvature: $screenCurvature
                    )
                    .ignoresSafeArea()
                    
                    hudOverlay
                }
            case .vrHeadset:
                ZStack {
                    StereoVRContainer(
                        streamClient: streamClient,
                        ipdMm: $ipdMm,
                        screenDistance: $screenDistance,
                        screenScale: $screenScale
                    )
                    .ignoresSafeArea()
                    
                    // VR Divider
                    Rectangle()
                        .fill(Color.white.opacity(0.3))
                        .frame(width: 2)
                        .ignoresSafeArea()
                }
                .onTapGesture {
                    streamClient.sendMouseButton(action: "click", button: "left")
                }
            }
        }
    }
    
    var connectionView: some View {
        VStack(spacing: 24) {
            Image(systemName: "eyeglasses")
                .font(.system(size: 64))
                .foregroundColor(.cyan)
                .padding(.top, 40)
            
            Text("Spatial VR Desktop")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Připojte iPhone k Windows PC pro prostorový streaming obrazovky.")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("IP adresa Windows serveru:")
                    .font(.caption)
                    .foregroundColor(.gray)
                
                TextField("172.20.10.2", text: $serverIP)
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .keyboardType(.numbersAndPunctuation)
            }
            .padding(.horizontal, 32)
            
            VStack(spacing: 12) {
                Button(action: {
                    streamClient.connect(host: serverIP)
                    currentMode = .arPassthrough
                }) {
                    HStack {
                        Image(systemName: "camera.viewfinder")
                        Text("Spustit v režimu AR (Passthrough)")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(LinearGradient(colors: [.blue, .cyan], startPoint: .leading, endPoint: .trailing))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
                
                Button(action: {
                    streamClient.connect(host: serverIP)
                    currentMode = .vrHeadset
                }) {
                    HStack {
                        Image(systemName: "eyeglasses")
                        Text("Spustit ve VR Brýlích (Stereo SBS)")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(LinearGradient(colors: [.purple, .blue], startPoint: .leading, endPoint: .trailing))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
            }
            .padding(.horizontal, 32)
            
            Spacer()
        }
    }
    
    var hudOverlay: some View {
        VStack {
            HStack {
                Text(streamClient.isConnected ? "Online: \(streamClient.currentFPS) FPS (\(streamClient.pingMs)ms)" : "Připojování...")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(streamClient.isConnected ? Color.green.opacity(0.3) : Color.orange.opacity(0.3))
                    .cornerRadius(20)
                    .foregroundColor(.white)
                
                Spacer()
                
                Button("Ukončit") {
                    streamClient.disconnect()
                    currentMode = .connection
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.red.opacity(0.3))
                .cornerRadius(20)
                .foregroundColor(.white)
            }
            .padding()
            
            Spacer()
            
            // Bottom Action bar
            HStack(spacing: 20) {
                Button("Levé kliknutí") {
                    streamClient.sendMouseButton(action: "click", button: "left")
                }
                .padding()
                .background(Color.white.opacity(0.2))
                .cornerRadius(12)
                .foregroundColor(.white)
                
                Button("Pravé kliknutí") {
                    streamClient.sendMouseButton(action: "click", button: "right")
                }
                .padding()
                .background(Color.white.opacity(0.2))
                .cornerRadius(12)
                .foregroundColor(.white)
            }
            .padding(.bottom, 20)
        }
    }
}
