// ios-client/SpatialVR/Streaming/StreamClient.swift
import Foundation
import UIKit
import Combine

public class StreamClient: ObservableObject {
    @Published public var isConnected = false
    @Published public var currentFPS = 0
    @Published public var pingMs = 0
    @Published public var latestFrame: UIImage?
    
    private var streamTask: URLSessionWebSocketTask?
    private var controlTask: URLSessionWebSocketTask?
    private var session = URLSession(configuration: .default)
    
    private var frameCount = 0
    private var lastFpsCheck = Date()
    private var pingTimer: Timer?
    private var lastPingSendTime: Date?
    
    public var host: String = ""
    public var port: Int = 3000
    
    public init() {}
    
    public func connect(host: String, port: Int = 3000) {
        self.host = host
        self.port = port
        disconnect()
        
        guard let streamURL = URL(string: "ws://\(host):\(port)/stream"),
              let controlURL = URL(string: "ws://\(host):\(port)/control") else {
            return
        }
        
        streamTask = session.webSocketTask(with: streamURL)
        controlTask = session.webSocketTask(with: controlURL)
        
        streamTask?.resume()
        controlTask?.resume()
        
        listenForFrames()
        listenForControl()
        startPingTimer()
    }
    
    public func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        
        streamTask?.cancel(with: .goingAway, reason: nil)
        controlTask?.cancel(with: .goingAway, reason: nil)
        
        streamTask = nil
        controlTask = nil
        
        DispatchQueue.main.async {
            self.isConnected = false
            self.currentFPS = 0
        }
    }
    
    private func listenForFrames() {
        streamTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    self.handleFrameData(data)
                default:
                    break
                }
                self.listenForFrames()
            case .failure(let error):
                print("[StreamClient] Stream receive error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self.isConnected = false
                }
            }
        }
    }
    
    private func handleFrameData(_ data: Data) {
        if let image = UIImage(data: data) {
            DispatchQueue.main.async {
                self.latestFrame = image
                self.isConnected = true
                self.frameCount += 1
                
                let now = Date()
                if now.timeIntervalSince(self.lastFpsCheck) >= 1.0 {
                    self.currentFPS = self.frameCount
                    self.frameCount = 0
                    self.lastFpsCheck = now
                }
            }
        }
    }
    
    private func listenForControl() {
        controlTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleControlMessage(text)
                default:
                    break
                }
                self.listenForControl()
            case .failure:
                break
            }
        }
    }
    
    private func handleControlMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }
        
        if type == "pong" {
            if let sendTime = self.lastPingSendTime {
                let rtt = Int(Date().timeIntervalSince(sendTime) * 1000)
                DispatchQueue.main.async {
                    self.pingMs = rtt
                }
            }
        }
    }
    
    private func startPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self, self.isConnected else { return }
            self.lastPingSendTime = Date()
            let pingJson = "{\"type\":\"ping\",\"clientTime\":\(Int(Date().timeIntervalSince1970 * 1000))}"
            self.controlTask?.send(.string(pingJson)) { _ in }
        }
    }
    
    public func sendMouseMove(x: Float, y: Float) {
        let json = "{\"type\":\"mouse_move\",\"x\":\(x),\"y\":\(y),\"isNormalized\":true}"
        controlTask?.send(.string(json)) { _ in }
    }
    
    public func sendMouseButton(action: String = "click", button: String = "left") {
        let json = "{\"type\":\"mouse_button\",\"action\":\"\(action)\",\"button\":\"\(button)\"}"
        controlTask?.send(.string(json)) { _ in }
    }
    
    public func sendMouseScroll(deltaY: Int, deltaX: Int = 0) {
        let json = "{\"type\":\"mouse_scroll\",\"deltaY\":\(deltaY),\"deltaX\":\(deltaX)}"
        controlTask?.send(.string(json)) { _ in }
    }
}
