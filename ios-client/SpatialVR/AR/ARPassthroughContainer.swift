// ios-client/SpatialVR/AR/ARPassthroughContainer.swift
import SwiftUI
import ARKit
import SceneKit

struct ARPassthroughContainer: UIViewRepresentable {
    @ObservedObject var streamClient: StreamClient
    @Binding var screenDistance: Float
    @Binding var screenScale: Float
    @Binding var screenCurvature: Float
    
    func makeUIView(context: Context) -> ARSCNView {
        let arView = ARSCNView(frame: .zero)
        arView.delegate = context.coordinator
        arView.session.delegate = context.coordinator
        arView.autoenablesDefaultLighting = true
        arView.automaticallyUpdatesLighting = true
        
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic
        arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
        
        context.coordinator.setupScene(arView: arView)
        return arView
    }
    
    func updateUIView(_ uiView: ARSCNView, context: Context) {
        context.coordinator.updateScreen(
            image: streamClient.latestFrame,
            distance: screenDistance,
            scale: screenScale,
            curvature: screenCurvature
        )
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(streamClient: streamClient)
    }
    
    class Coordinator: NSObject, ARSCNViewDelegate, ARSessionDelegate {
        var streamClient: StreamClient
        var screenNode: SCNNode?
        var screenMaterial: SCNMaterial?
        var arView: ARSCNView?
        
        init(streamClient: StreamClient) {
            self.streamClient = streamClient
        }
        
        func setupScene(arView: ARSCNView) {
            self.arView = arView
            
            let width: CGFloat = 1.6
            let height: CGFloat = 0.9
            let plane = SCNPlane(width: width, height: height)
            plane.cornerRadius = 0.02
            
            let material = SCNMaterial()
            material.isDoubleSided = true
            material.diffuse.contents = UIColor.black
            plane.materials = [material]
            
            self.screenMaterial = material
            let node = SCNNode(geometry: plane)
            node.name = "virtualMonitor"
            node.position = SCNVector3(x: 0, y: 0, z: -1.8)
            
            arView.scene.rootNode.addChildNode(node)
            self.screenNode = node
        }
        
        func updateScreen(image: UIImage?, distance: Float, scale: Float, curvature: Float) {
            guard let screenNode = screenNode else { return }
            
            if let image = image {
                screenMaterial?.diffuse.contents = image
            }
            
            screenNode.scale = SCNVector3(x: scale, y: scale, z: scale)
        }
        
        func session(_ session: ARSession, didUpdate frame: ARFrame) {
            guard let arView = arView, let screenNode = screenNode else { return }
            
            let centerPoint = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
            let options: [SCNHitTestOption: Any] = [
                SCNHitTestOption.rootNode: screenNode,
                SCNHitTestOption.searchMode: SCNHitTestSearchMode.all.rawValue
            ]
            let hitResults = arView.hitTest(centerPoint, options: options)
            
            if let firstHit = hitResults.first {
                let uv = firstHit.textureCoordinates(withMappingChannel: 0)
                let normX = Float(uv.x)
                let normY = Float(1.0 - uv.y)
                streamClient.sendMouseMove(x: normX, y: normY)
            }
        }
    }
}
